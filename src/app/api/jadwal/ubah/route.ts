import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { HariPiket } from "@prisma/client";

const VALID_DAYS: HariPiket[] = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];

export async function POST(req: NextRequest) {
  try {
    const { adminId, targetUserId, hariBaru } = await req.json();

    const admin = await prisma.user.findUnique({ where: { id: Number(adminId) } });
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Akses ditolak. Khusus Admin." }, { status: 403 });
    }

    if (!VALID_DAYS.includes(hariBaru)) {
      return NextResponse.json({ error: "Hari piket tidak valid." }, { status: 400 });
    }

    const targetId = Number(targetUserId);

    await prisma.$transaction([
      prisma.jadwalPiket.deleteMany({ where: { userId: targetId } }),
      prisma.jadwalPiket.create({
        data: { userId: targetId, hari: hariBaru },
      }),
    ]);

    const updatedUsers = await prisma.user.findMany({
      include: { jadwalPiket: true },
      orderBy: { nama: "asc" },
    });

    return NextResponse.json({
      message: "Jadwal pengurus berhasil diperbarui!",
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
    return NextResponse.json({ error: "Gagal mengubah jadwal pengurus." }, { status: 500 });
  }
}