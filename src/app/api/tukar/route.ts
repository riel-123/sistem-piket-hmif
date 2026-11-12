import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { HariPiket } from "@prisma/client";

const URUTAN_HARI: Record<HariPiket, number> = {
  Senin: 1,
  Selasa: 2,
  Rabu: 3,
  Kamis: 4,
  Jumat: 5,
};

function isHariSudahLewatWib(hariTarget: HariPiket): { lewat: boolean; alasan?: string } {
  const nowWib = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const dayOfWeek = nowWib.getDay();
  const jam = nowWib.getHours();

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { lewat: false };
  }

  const indeksHariIni = dayOfWeek;
  const indeksTarget = URUTAN_HARI[hariTarget];

  if (indeksTarget < indeksHariIni) {
    return {
      lewat: true,
      alasan: `Hari ${hariTarget} sudah lewat untuk minggu ini dan tidak dapat ditukar.`,
    };
  }

  if (indeksTarget === indeksHariIni && jam >= 17) {
    return {
      lewat: true,
      alasan: `Jadwal piket hari ${hariTarget} (hari ini) sudah selesai pukul 17.00 WIB dan tidak dapat ditukar.`,
    };
  }

  return { lewat: false };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode");
  const userId = Number(searchParams.get("userId"));

  // Mode khusus Panel Admin: ambil semua riwayat tukar jadwal seluruh pengurus
  if (mode === "admin") {
    const allTukar = await prisma.tukarJadwal.findMany({
      include: {
        pemohon: { select: { id: true, nama: true, divisi: true, nim: true } },
        tujuan: { select: { id: true, nama: true, divisi: true, nim: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ allTukar });
  }

  if (!userId) {
    return NextResponse.json({ masuk: [], keluar: [] });
  }

  const [masuk, keluar] = await Promise.all([
    prisma.tukarJadwal.findMany({
      where: { tujuanId: userId },
      include: {
        pemohon: { select: { id: true, nama: true, divisi: true, nim: true } },
        tujuan: { select: { id: true, nama: true, divisi: true, nim: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tukarJadwal.findMany({
      where: { pemohonId: userId },
      include: {
        pemohon: { select: { id: true, nama: true, divisi: true, nim: true } },
        tujuan: { select: { id: true, nama: true, divisi: true, nim: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ masuk, keluar });
}

export async function POST(req: NextRequest) {
  try {
    const { pemohonId, tujuanId, alasan } = await req.json();

    const pId = Number(pemohonId);
    const tId = Number(tujuanId);

    if (!pId || !tId || pId === tId) {
      return NextResponse.json({ error: "Pilih rekan pengurus yang valid." }, { status: 400 });
    }

    if (!alasan || alasan.trim().length < 4) {
      return NextResponse.json({ error: "Alasan tukar jadwal wajib diisi." }, { status: 400 });
    }

    const [pemohon, tujuan] = await Promise.all([
      prisma.user.findUnique({ where: { id: pId }, include: { jadwalPiket: true } }),
      prisma.user.findUnique({ where: { id: tId }, include: { jadwalPiket: true } }),
    ]);

    const hariPemohon = pemohon?.jadwalPiket[0]?.hari;
    const hariTujuan = tujuan?.jadwalPiket[0]?.hari;

    if (!hariPemohon || !hariTujuan) {
      return NextResponse.json(
        { error: "Salah satu pengurus belum memiliki jadwal piket aktif." },
        { status: 400 }
      );
    }

    const cekPemohon = isHariSudahLewatWib(hariPemohon);
    if (cekPemohon.lewat) {
      return NextResponse.json(
        { error: `Jadwalmu (${hariPemohon}) sudah berlalu di minggu ini, tidak bisa ditukar.` },
        { status: 400 }
      );
    }

    const cekTujuan = isHariSudahLewatWib(hariTujuan);
    if (cekTujuan.lewat) {
      return NextResponse.json(
        {
          error:
            cekTujuan.alasan || `Tidak bisa bertukar dengan hari ${hariTujuan} yang sudah lewat.`,
        },
        { status: 400 }
      );
    }

    if (hariPemohon === hariTujuan) {
      return NextResponse.json(
        { error: `Jadwal kalian berdua sudah sama-sama di hari ${hariPemohon}.` },
        { status: 400 }
      );
    }

    const existingPending = await prisma.tukarJadwal.findFirst({
      where: { pemohonId: pId, tujuanId: tId, status: "pending" },
    });

    if (existingPending) {
      return NextResponse.json(
        { error: "Kamu sudah mengirim pengajuan yang masih menunggu konfirmasi ke rekan ini." },
        { status: 400 }
      );
    }

    const created = await prisma.tukarJadwal.create({
      data: {
        pemohonId: pId,
        tujuanId: tId,
        hariPemohon,
        hariTujuan,
        alasan: alasan.trim(),
      },
    });

    return NextResponse.json({
      message: `Pengajuan tukar jadwal (${hariPemohon} ↔ ${hariTujuan}) berhasil dikirim ke ${tujuan?.nama}!`,
      data: created,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal mengirim pengajuan tukar jadwal." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { requestId, userId, aksi } = await req.json();

    const tukar = await prisma.tukarJadwal.findUnique({
      where: { id: Number(requestId) },
      include: {
        pemohon: { include: { jadwalPiket: true } },
        tujuan: { include: { jadwalPiket: true } },
      },
    });

    if (!tukar) {
      return NextResponse.json({ error: "Data pengajuan tidak ditemukan." }, { status: 404 });
    }

    if (tukar.tujuanId !== Number(userId)) {
      return NextResponse.json(
        { error: "Hanya penerima pengajuan yang dapat mengonfirmasi." },
        { status: 403 }
      );
    }

    if (tukar.status !== "pending") {
      return NextResponse.json({ error: "Pengajuan ini sudah diproses sebelumnya." }, { status: 400 });
    }

    if (aksi === "tolak") {
      await prisma.tukarJadwal.update({
        where: { id: tukar.id },
        data: { status: "ditolak" },
      });
      return NextResponse.json({
        message: "Pengajuan tukar jadwal ditolak. Jadwal tetap tidak berubah.",
      });
    }

    const hariAktualPemohon = tukar.pemohon.jadwalPiket[0]?.hari || tukar.hariPemohon;
    const hariAktualTujuan = tukar.tujuan.jadwalPiket[0]?.hari || tukar.hariTujuan;

    const cekPemohon = isHariSudahLewatWib(hariAktualPemohon);
    const cekTujuan = isHariSudahLewatWib(hariAktualTujuan);
    if (cekPemohon.lewat || cekTujuan.lewat) {
      await prisma.tukarJadwal.update({
        where: { id: tukar.id },
        data: { status: "ditolak" },
      });
      return NextResponse.json(
        {
          error:
            "Pengajuan otomatis dibatalkan karena salah satu jadwal piket sudah melewati harinya.",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.jadwalPiket.deleteMany({
        where: { userId: { in: [tukar.pemohonId, tukar.tujuanId] } },
      }),
      prisma.jadwalPiket.createMany({
        data: [
          { userId: tukar.pemohonId, hari: hariAktualTujuan },
          { userId: tukar.tujuanId, hari: hariAktualPemohon },
        ],
      }),
      prisma.tukarJadwal.update({
        where: { id: tukar.id },
        data: { status: "disetujui" },
      }),
    ]);

    return NextResponse.json({
      message: `Disetujui! Jadwal berhasil ditukar (Sekarang jadwalmu: ${hariAktualPemohon}).`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal memproses konfirmasi tukar jadwal." }, { status: 500 });
  }
}