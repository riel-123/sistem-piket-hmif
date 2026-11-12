import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

async function verifyAdmin(adminId: number) {
  if (!adminId) return false;
  const admin = await prisma.user.findUnique({ where: { id: Number(adminId) } });
  return Boolean(admin && String(admin.role).toLowerCase() === "admin");
}

// PATCH: Admin menyetujui (approve) atau menolak (tolak -> alfa) bukti foto pengurus
export async function PATCH(req: NextRequest) {
  try {
    const { adminId, userId, tanggal, aksi } = await req.json();

    if (!(await verifyAdmin(adminId))) {
      return NextResponse.json({ error: "Akses ditolak. Khusus Admin." }, { status: 403 });
    }

    const uId = Number(userId);
    if (!uId || !tanggal || !["approve", "tolak"].includes(aksi)) {
      return NextResponse.json({ error: "Data validasi tidak lengkap." }, { status: 400 });
    }

    const record = await prisma.presensi.findFirst({
      where: { userId: uId, tanggal: String(tanggal) },
    });

    if (!record) {
      return NextResponse.json(
        { error: "Pengurus ini belum mengirim laporan foto pada tanggal tersebut." },
        { status: 404 }
      );
    }

    const cleanChecklist = (record.checklistTugas || []).filter(
      (item) => item !== "__PENDING_ADMIN__"
    );
    const cleanAlasan = record.alasanIzin
      ? record.alasanIzin.replace(/^__PENDING_ADMIN__\s*/, "")
      : null;

    if (aksi === "approve") {
      await prisma.presensi.update({
        where: { id: record.id },
        data: {
          checklistTugas: cleanChecklist,
          alasanIzin: cleanAlasan,
        },
      });

      return NextResponse.json({
        message: `Bukti piket tanggal ${tanggal} berhasil di-APPROVE (Dinyatakan Sah ${record.status.toUpperCase()})!`,
      });
    } else {
      // Jika ditolak oleh admin, ubah status menjadi Alfa
      await prisma.presensi.update({
        where: { id: record.id },
        data: {
          status: "alfa",
          checklistTugas: cleanChecklist,
          alasanIzin: cleanAlasan ? `[Ditolak Admin] ${cleanAlasan}` : "[Ditolak Admin]",
        },
      });

      return NextResponse.json({
        message: `Laporan tanggal ${tanggal} DITOLAK oleh Admin dan dicatat sebagai ALFA.`,
      });
    }
  } catch (error) {
    console.error("Error PATCH /api/laporan/manage:", error);
    return NextResponse.json({ error: "Gagal memproses validasi laporan." }, { status: 500 });
  }
}

// POST: Input / Edit manual status presensi oleh Admin
export async function POST(req: NextRequest) {
  try {
    const { adminId, userId, tanggal, status, waktuLapor, jenisIzin, alasanIzin } =
      await req.json();

    if (!(await verifyAdmin(adminId))) {
      return NextResponse.json({ error: "Akses ditolak. Khusus Admin." }, { status: 403 });
    }

    const uId = Number(userId);
    if (!uId || !tanggal || !["hadir", "izin", "alfa"].includes(status)) {
      return NextResponse.json(
        { error: "Pilih pengurus, tanggal, dan status dengan benar." },
        { status: 400 }
      );
    }

    const existing = await prisma.presensi.findFirst({
      where: { userId: uId, tanggal: String(tanggal) },
    });

    const payload = {
      status: status as "hadir" | "izin" | "alfa",
      waktuLapor: waktuLapor && String(waktuLapor).trim() ? String(waktuLapor).trim() : "Admin",
      jenisIzin: status === "izin" ? String(jenisIzin || "Izin Admin") : null,
      alasanIzin: status === "izin" ? String(alasanIzin || "Divalidasi Admin") : null,
      checklistTugas: status === "hadir" ? ["Divalidasi oleh Admin"] : [],
    };

    if (existing) {
      await prisma.presensi.update({
        where: { id: existing.id },
        data: payload,
      });
    } else {
      await prisma.presensi.create({
        data: {
          userId: uId,
          tanggal: String(tanggal),
          ...payload,
        },
      });
    }

    return NextResponse.json({
      message: `Status kehadiran tanggal ${tanggal} berhasil disimpan sebagai ${status.toUpperCase()}!`,
    });
  } catch (error) {
    console.error("Error POST /api/laporan/manage:", error);
    return NextResponse.json({ error: "Gagal menyimpan data kehadiran." }, { status: 500 });
  }
}

// DELETE: Reset / Hapus catatan presensi
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminId = Number(searchParams.get("adminId"));
    const userId = Number(searchParams.get("userId"));
    const tanggal = searchParams.get("tanggal");

    if (!(await verifyAdmin(adminId))) {
      return NextResponse.json({ error: "Akses ditolak. Khusus Admin." }, { status: 403 });
    }

    if (!userId || !tanggal) {
      return NextResponse.json({ error: "Parameter userId dan tanggal wajib ada." }, { status: 400 });
    }

    await prisma.presensi.deleteMany({
      where: { userId, tanggal },
    });

    return NextResponse.json({
      message: `Catatan presensi tanggal ${tanggal} berhasil direset.`,
    });
  } catch (error) {
    console.error("Error DELETE /api/laporan/manage:", error);
    return NextResponse.json({ error: "Gagal menghapus catatan presensi." }, { status: 500 });
  }
}