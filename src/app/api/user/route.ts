import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { HariPiket } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const { adminId, nim, nama, divisi, password, role, hari } = await req.json();

    const admin = await prisma.user.findUnique({ where: { id: Number(adminId) } });
    if (!admin || String(admin.role).toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Akses ditolak. Khusus Admin." }, { status: 403 });
    }

    if (!nim || !nama || !divisi || !password || !hari) {
      return NextResponse.json({ error: "Semua kolom wajib diisi." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { nim: String(nim).trim() } });
    if (existing) {
      return NextResponse.json({ error: `NIM ${nim} sudah terdaftar.` }, { status: 400 });
    }

    const newUser = await prisma.user.create({
      data: {
        nim: String(nim).trim(),
        nama: String(nama).trim(),
        divisi: String(divisi).trim(),
        password: String(password).trim(),
        role: role === "admin" ? "admin" : "pengurus",
        jadwalPiket: {
          create: { hari: hari as HariPiket },
        },
      },
    });

    return NextResponse.json({
      message: `Anggota baru ${newUser.nama} (${newUser.nim}) berhasil ditambahkan ke hari ${hari}!`,
      user: newUser,
    });
  } catch (error) {
    console.error("Error tambah anggota:", error);
    return NextResponse.json({ error: "Gagal menambahkan anggota baru." }, { status: 500 });
  }
}