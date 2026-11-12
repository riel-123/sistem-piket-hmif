import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { HariPiket } from "@prisma/client";

const HARI_MAP: Record<number, HariPiket | null> = {
  0: null,
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: null,
};

function getNowWibInfo() {
  const now = new Date();

  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = dateParts.find((p) => p.type === "year")?.value;
  const m = dateParts.find((p) => p.type === "month")?.value;
  const d = dateParts.find((p) => p.type === "day")?.value;
  const tanggalWib = `${y}-${m}-${d}`;

  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hour = Number(timeParts.find((p) => p.type === "hour")?.value || 0);
  const minute = timeParts.find((p) => p.type === "minute")?.value || "00";
  const waktuLaporWib = `${String(hour).padStart(2, "0")}:${minute}`;

  const wibNoon = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0, 0));
  const hariIni = HARI_MAP[wibNoon.getUTCDay()];

  return { tanggalWib, waktuLaporWib, hour, hariIni };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const userId = Number(formData.get("userId"));
    const tipe = String(formData.get("tipe")) as "hadir" | "izin";
    const foto = formData.get("foto") as File | null;

    if (!userId || !foto) {
      return NextResponse.json(
        { error: "Data pengguna dan foto bukti wajib dilengkapi." },
        { status: 400 }
      );
    }

    const { tanggalWib, waktuLaporWib, hour, hariIni } = getNowWibInfo();

    if (!hariIni) {
      return NextResponse.json(
        { error: "Hari Sabtu dan Minggu libur piket sekretariat." },
        { status: 400 }
      );
    }

    if (hour < 7 || hour >= 17) {
      return NextResponse.json(
        { error: "Absensi piket hanya dibuka pada pukul 07.00 – 17.00 WIB." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { jadwalPiket: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Akun pengurus tidak ditemukan." }, { status: 404 });
    }

    const punyaJadwalHariIni = user.jadwalPiket.some((j) => j.hari === hariIni);
    if (!punyaJadwalHariIni) {
      return NextResponse.json(
        { error: `Hari ini (${hariIni}) bukan jadwal piketmu.` },
        { status: 403 }
      );
    }

    const existing = await prisma.presensi.findFirst({
      where: { userId, tanggal: tanggalWib },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Kamu sudah mengisi laporan piket untuk tanggal ${tanggalWib}.` },
        { status: 400 }
      );
    }

    // Upload foto ke Supabase Storage bucket "bukti-piket"
    const arrayBuffer = await foto.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = foto.name.split(".").pop() || "jpg";
    const fileName = `${tanggalWib}/${user.nim}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("bukti-piket")
      .upload(fileName, buffer, {
        contentType: foto.type || "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return NextResponse.json(
        { error: "Gagal mengunggah foto bukti ke server penyimpanan." },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("bukti-piket")
      .getPublicUrl(fileName);
    const publicUrl = publicUrlData.publicUrl;

    if (tipe === "hadir") {
      const checklistRaw = formData.get("checklist");
      const checklistTugas = checklistRaw ? JSON.parse(String(checklistRaw)) : [];

      await prisma.presensi.create({
        data: {
          userId,
          tanggal: tanggalWib,
          status: "hadir",
          waktuLapor: waktuLaporWib,
          fotoSekre: publicUrl,
          checklistTugas,
        },
      });

      return NextResponse.json({
        message: `Laporan piket hari ${hariIni} (${tanggalWib}) pukul ${waktuLaporWib} WIB berhasil dicatat!`,
      });
    } else {
      const jenisIzin = String(formData.get("jenisIzin") || "Lainnya");
      const alasanIzin = String(formData.get("alasanIzin") || "");

      await prisma.presensi.create({
        data: {
          userId,
          tanggal: tanggalWib,
          status: "izin",
          waktuLapor: waktuLaporWib,
          jenisIzin,
          alasanIzin,
          fotoBuktiIzin: publicUrl,
        },
      });

      return NextResponse.json({
        message: `Pengajuan izin piket hari ${hariIni} (${tanggalWib}) berhasil dikirim!`,
      });
    }
  } catch (error) {
    console.error("Error POST /api/presensi:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat menyimpan presensi." },
      { status: 500 }
    );
  }
}