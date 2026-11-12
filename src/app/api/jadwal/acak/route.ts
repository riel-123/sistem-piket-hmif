import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { HariPiket } from "@prisma/client";

const HARI_KERJA: HariPiket[] = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];

function checkWaktuAcakWib() {
  // Mode testing aktif: tombol acak dibuka kapan saja
  return { isAllowed: true };
}

export async function POST(req: NextRequest) {
  try {
    const { adminId } = await req.json();

    const admin = await prisma.user.findUnique({ where: { id: Number(adminId) } });
    if (!admin || String(admin.role).toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Akses ditolak. Khusus Admin." }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: { id: "asc" },
    });

    if (users.length === 0) {
      return NextResponse.json({ error: "Belum ada data pengurus." }, { status: 400 });
    }

    // 1. Acak urutan pengurus (Fisher-Yates Shuffle)
    const shuffledUsers = [...users];
    for (let i = shuffledUsers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledUsers[i], shuffledUsers[j]] = [shuffledUsers[j], shuffledUsers[i]];
    }

    // 2. Acak urutan 5 hari kerja agar pembagian sisa merata
    const shuffledDays = [...HARI_KERJA];
    for (let i = shuffledDays.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledDays[i], shuffledDays[j]] = [shuffledDays[j], shuffledDays[i]];
    }

    // 3. Bagikan tepat 1 hari per orang secara merata (11-12 orang/hari untuk 57 pengurus)
    const newSchedules = shuffledUsers.map((u, idx) => ({
      userId: u.id,
      hari: shuffledDays[idx % shuffledDays.length],
    }));

    // 4. Reset jadwal lama & simpan jadwal baru
    await prisma.$transaction([
      prisma.jadwalPiket.deleteMany({}),
      prisma.jadwalPiket.createMany({ data: newSchedules }),
    ]);

    const updatedUsers = await prisma.user.findMany({
      include: { jadwalPiket: true },
      orderBy: { nama: "asc" },
    });

    return NextResponse.json({
      message: `Berhasil mengacak jadwal untuk ${updatedUsers.length} pengurus (1 hari/minggu)!`,
      users: updatedUsers.map((u) => ({
        id: u.id,
        nim: u.nim,
        nama: u.nama,
        divisi: u.divisi,
        hari: u.jadwalPiket[0]?.hari || "-",
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal mengacak jadwal piket." }, { status: 500 });
  }
}

export async function GET() {
  const { isAllowed } = checkWaktuAcakWib();
  const users = await prisma.user.findMany({
    include: { jadwalPiket: true },
    orderBy: { nama: "asc" },
  });

  return NextResponse.json({
    isAllowed,
    users: users.map((u) => ({
      id: u.id,
      nim: u.nim,
      nama: u.nama,
      divisi: u.divisi,
      hari: u.jadwalPiket[0]?.hari || "-",
    })),
  });
}