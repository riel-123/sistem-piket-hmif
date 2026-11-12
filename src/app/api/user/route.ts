import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { HariPiket } from "@prisma/client";

async function verifyAdmin(adminId: number) {
  if (!adminId) return false;
  const admin = await prisma.user.findUnique({ where: { id: Number(adminId) } });
  return Boolean(admin && String(admin.role).toLowerCase() === "admin");
}

// READ: Ambil seluruh daftar anggota beserta jadwalnya
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      include: { jadwalPiket: true },
      orderBy: [{ divisi: "asc" }, { nama: "asc" }],
    });

    const formatted = users.map((u) => ({
      id: u.id,
      nim: u.nim,
      nama: u.nama,
      divisi: u.divisi,
      password: u.password,
      role: u.role,
      hari: u.jadwalPiket[0]?.hari || "-",
    }));

    return NextResponse.json({ users: formatted });
  } catch (error) {
    console.error("Error GET /api/user:", error);
    return NextResponse.json({ users: [] }, { status: 500 });
  }
}

// CREATE: Tambah anggota baru
export async function POST(req: NextRequest) {
  try {
    const { adminId, nim, nama, divisi, password, role, hari } = await req.json();

    if (!(await verifyAdmin(adminId))) {
      return NextResponse.json({ error: "Akses ditolak. Khusus Admin." }, { status: 403 });
    }

    if (!nim || !nama || !divisi || !password || !hari) {
      return NextResponse.json({ error: "Semua kolom wajib diisi." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { nim: String(nim).trim() } });
    if (existing) {
      return NextResponse.json({ error: `NIM ${nim} sudah terdaftar di sistem.` }, { status: 400 });
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
      message: `Anggota baru ${newUser.nama} (${newUser.nim}) berhasil ditambahkan ke jadwal ${hari}!`,
      user: newUser,
    });
  } catch (error) {
    console.error("Error POST /api/user:", error);
    return NextResponse.json({ error: "Gagal menambahkan anggota baru." }, { status: 500 });
  }
}

// UPDATE: Edit data anggota (NIM, nama, departemen, password, role, jadwal hari)
export async function PATCH(req: NextRequest) {
  try {
    const { adminId, userId, nim, nama, divisi, password, role, hari } = await req.json();

    if (!(await verifyAdmin(adminId))) {
      return NextResponse.json({ error: "Akses ditolak. Khusus Admin." }, { status: 403 });
    }

    const targetId = Number(userId);
    if (!targetId || !nim || !nama || !divisi || !hari) {
      return NextResponse.json({ error: "Data edit anggota tidak lengkap." }, { status: 400 });
    }

    const duplicateNim = await prisma.user.findFirst({
      where: {
        nim: String(nim).trim(),
        NOT: { id: targetId },
      },
    });

    if (duplicateNim) {
      return NextResponse.json(
        { error: `NIM ${nim} sudah digunakan oleh anggota lain.` },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: targetId },
        data: {
          nim: String(nim).trim(),
          nama: String(nama).trim(),
          divisi: String(divisi).trim(),
          ...(password && String(password).trim()
            ? { password: String(password).trim() }
            : {}),
          role: role === "admin" ? "admin" : "pengurus",
        },
      }),
      prisma.jadwalPiket.deleteMany({ where: { userId: targetId } }),
      prisma.jadwalPiket.create({
        data: { userId: targetId, hari: hari as HariPiket },
      }),
    ]);

    return NextResponse.json({
      message: `Data pengurus ${nama} berhasil diperbarui!`,
    });
  } catch (error) {
    console.error("Error PATCH /api/user:", error);
    return NextResponse.json({ error: "Gagal memperbarui data anggota." }, { status: 500 });
  }
}

// DELETE: Hapus anggota beserta jadwal, presensi, dan riwayat tukar jadwalnya
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminId = Number(searchParams.get("adminId"));
    const userId = Number(searchParams.get("userId"));

    if (!(await verifyAdmin(adminId))) {
      return NextResponse.json({ error: "Akses ditolak. Khusus Admin." }, { status: 403 });
    }

    if (!userId) {
      return NextResponse.json({ error: "ID anggota tidak valid." }, { status: 400 });
    }

    if (adminId === userId) {
      return NextResponse.json(
        { error: "Tidak dapat menghapus akun admin yang sedang dipakai login." },
        { status: 400 }
      );
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json({ error: "Anggota tidak ditemukan." }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.tukarJadwal.deleteMany({
        where: { OR: [{ pemohonId: userId }, { tujuanId: userId }] },
      }),
      prisma.presensi.deleteMany({ where: { userId } }),
      prisma.jadwalPiket.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    return NextResponse.json({
      message: `Anggota ${target.nama} (${target.nim}) berhasil dihapus permanen.`,
    });
  } catch (error) {
    console.error("Error DELETE /api/user:", error);
    return NextResponse.json({ error: "Gagal menghapus anggota." }, { status: 500 });
  }
}