import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { nim, password } = await req.json();

    const user = await prisma.user.findUnique({
      where: { nim },
      include: { jadwalPiket: true },
    });

    if (!user || user.password !== password) {
      return NextResponse.json({ error: "NIM atau password salah." }, { status: 401 });
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
    return NextResponse.json({ error: "Gagal memproses login." }, { status: 500 });
  }
}