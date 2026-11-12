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

function getWibNow() {
  const now = new Date();
  const wibString = now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
  const wibDate = new Date(wibString);
  const yyyy = wibDate.getFullYear();
  const mm = String(wibDate.getMonth() + 1).padStart(2, "0");
  const dd = String(wibDate.getDate()).padStart(2, "0");
  const hh = String(wibDate.getHours()).padStart(2, "0");
  const min = String(wibDate.getMinutes()).padStart(2, "0");

  return {
    tanggal: `${yyyy}-${mm}-${dd}`,
    jam: `${hh}:${min}`,
    hourNumber: wibDate.getHours(),
    hariIni: HARI_MAP[wibDate.getDay()],
  };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const userId = Number(formData.get("userId"));
    const tipe = formData.get("tipe") as "hadir" | "izin";
    const file = formData.get("foto") as File | null;

    const { tanggal, jam, hourNumber, hariIni } = getWibNow();

    if (!hariIni) {
      return NextResponse.json(
        { error: "Hari ini libur akhir pekan, tidak ada jadwal piket." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { jadwalPiket: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    }

    const isScheduledToday = user.jadwalPiket.some((j) => j.hari === hariIni);
    if (!isScheduledToday) {
      return NextResponse.json(
        { error: "Hari ini kamu tidak piket, jadi tidak bisa diakses ya!!" },
        { status: 403 }
      );
    }

    if (hourNumber < 7 || hourNumber >= 17) {
      return NextResponse.json(
        { error: "Absensi & pengajuan izin hanya dibuka pukul 07.00 - 17.00 WIB." },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json({ error: "Foto bukti wajib dilampirkan." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `${tanggal}/${tipe}-${userId}-${Date.now()}.jpg`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("bukti-piket")
      .upload(fileName, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Supabase Upload Error:", uploadError);
      return NextResponse.json({ error: "Gagal mengunggah foto bukti." }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("bukti-piket")
      .getPublicUrl(fileName);
    const fileUrl = publicUrlData.publicUrl;

    if (tipe === "hadir") {
      const checklist = JSON.parse((formData.get("checklist") as string) || "[]");
      const record = await prisma.presensi.upsert({
        where: { userId_tanggal: { userId, tanggal } },
        update: { status: "hadir", waktuLapor: jam, fotoSekre: fileUrl, checklistTugas: checklist },
        create: { userId, tanggal, waktuLapor: jam, status: "hadir", fotoSekre: fileUrl, checklistTugas: checklist },
      });
      return NextResponse.json({ message: "Laporan piket berhasil dicatat!", data: record });
    } else {
      const jenisIzin = formData.get("jenisIzin") as string;
      const alasanIzin = formData.get("alasanIzin") as string;

      if (!jenisIzin || !alasanIzin) {
        return NextResponse.json({ error: "Jenis izin dan alasan wajib diisi." }, { status: 400 });
      }

      const record = await prisma.presensi.upsert({
        where: { userId_tanggal: { userId, tanggal } },
        update: { status: "izin", waktuLapor: jam, jenisIzin, alasanIzin, fotoBuktiIzin: fileUrl },
        create: { userId, tanggal, waktuLapor: jam, status: "izin", jenisIzin, alasanIzin, fotoBuktiIzin: fileUrl },
      });
      return NextResponse.json({ message: "Pengajuan izin berhasil dikirim!", data: record });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}