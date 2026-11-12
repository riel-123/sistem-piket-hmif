import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      include: { jadwalPiket: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      nim: user.nim,
      nama: user.nama,
      divisi: user.divisi,
      role: user.role,
      jadwal: user.jadwalPiket.map((j) => j.hari),
    });
  } catch {
    return NextResponse.json({ error: "Gagal memuat data user" }, { status: 500 });
  }
}