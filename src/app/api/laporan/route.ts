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

function getWibContext() {
  const nowWib = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const yyyy = nowWib.getFullYear();
  const mm = String(nowWib.getMonth() + 1).padStart(2, "0");
  const dd = String(nowWib.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;
  const isAfter5PM = nowWib.getHours() >= 17;

  // Hitung tanggal Senin minggu ini untuk acuan jadwal minggu berjalan
  const mondayDate = new Date(nowWib);
  const day = mondayDate.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  mondayDate.setDate(mondayDate.getDate() + diffToMonday);

  const mY = mondayDate.getFullYear();
  const mM = String(mondayDate.getMonth() + 1).padStart(2, "0");
  const mD = String(mondayDate.getDate()).padStart(2, "0");
  const currentWeekMondayStr = `${mY}-${mM}-${mD}`;

  return { todayStr, isAfter5PM, currentWeekMondayStr };
}

function getDatesInRange(startStr: string, endStr: string) {
  const dates: { tanggal: string; hari: HariPiket }[] = [];
  const curr = new Date(`${startStr}T00:00:00+07:00`);
  const end = new Date(`${endStr}T00:00:00+07:00`);

  while (curr <= end) {
    const namaHari = HARI_MAP[curr.getDay()];
    if (namaHari) {
      const yyyy = curr.getFullYear();
      const mm = String(curr.getMonth() + 1).padStart(2, "0");
      const dd = String(curr.getDate()).padStart(2, "0");
      dates.push({ tanggal: `${yyyy}-${mm}-${dd}`, hari: namaHari });
    }
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

// Hapus otomatis seluruh foto bukti dari hari-hari sebelumnya (< todayStr)
async function cleanupDailyPhotos(todayStr: string) {
  try {
    const oldRecords = await prisma.presensi.findMany({
      where: {
        tanggal: { lt: todayStr },
        OR: [{ fotoSekre: { not: null } }, { fotoBuktiIzin: { not: null } }],
      },
      select: { id: true, fotoSekre: true, fotoBuktiIzin: true },
    });

    if (oldRecords.length === 0) return;

    const pathsToDelete: string[] = [];
    for (const rec of oldRecords) {
      for (const url of [rec.fotoSekre, rec.fotoBuktiIzin]) {
        if (url && url.includes("/bukti-piket/")) {
          const storagePath = url.split("/bukti-piket/")[1];
          if (storagePath) pathsToDelete.push(decodeURIComponent(storagePath));
        }
      }
    }

    if (pathsToDelete.length > 0) {
      await supabaseAdmin.storage.from("bukti-piket").remove(pathsToDelete);
    }

    await prisma.presensi.updateMany({
      where: { id: { in: oldRecords.map((r) => r.id) } },
      data: { fotoSekre: null, fotoBuktiIzin: null },
    });
  } catch (err) {
    console.error("Cleanup foto harian gagal:", err);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start")!;
  const end = searchParams.get("end")!;

  const { todayStr, isAfter5PM, currentWeekMondayStr } = getWibContext();

  // Jalankan pembersihan foto hari sebelumnya setiap ganti hari
  await cleanupDailyPhotos(todayStr);

  const activeDates = getDatesInRange(start, end);
  const users = await prisma.user.findMany({
    include: {
      jadwalPiket: true,
      presensi: {
        where: { tanggal: { gte: start, lte: end } },
        orderBy: { tanggal: "asc" },
      },
    },
    orderBy: { nama: "asc" },
  });

  const detailLogs: any[] = [];
  const rekapUser = users.map((u) => {
    const hariTugasMingguIni = u.jadwalPiket.map((j) => j.hari);
    const createdDateStr = new Date(
      new Date(u.createdAt).toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
    )
      .toISOString()
      .slice(0, 10);

    let hadir = 0;
    let izin = 0;
    let alfa = 0;
    let belumAbsen = 0;
    const riwayatHari: { tanggal: string; hari: string; status: string }[] = [];

    activeDates.forEach(({ tanggal, hari }) => {
      const found = u.presensi.find((p) => p.tanggal === tanggal);
      const isCurrentWeek = tanggal >= currentWeekMondayStr;

      if (!isCurrentWeek) {
        if (!found) return;
      } else {
        if (tanggal < createdDateStr && !found) return;
        if (!hariTugasMingguIni.includes(hari) && !found) return;
      }

      let statusFinal: "hadir" | "izin" | "alfa" | "belum_absen" = "belum_absen";

      if (found) {
        statusFinal = found.status;
      } else if (tanggal < todayStr || (tanggal === todayStr && isAfter5PM)) {
        statusFinal = "alfa";
      }

      if (statusFinal === "hadir") hadir++;
      else if (statusFinal === "izin") izin++;
      else if (statusFinal === "alfa") alfa++;
      else belumAbsen++;

      riwayatHari.push({
        tanggal,
        hari,
        status: statusFinal,
      });

      // Foto hanya tersedia untuk hari ini
      const isToday = tanggal === todayStr;
      const fotoSekreAktif = isToday ? found?.fotoSekre || null : null;
      const fotoIzinAktif = isToday ? found?.fotoBuktiIzin || null : null;

      detailLogs.push({
        tanggal,
        hari,
        userId: u.id,
        nim: u.nim,
        nama: u.nama,
        divisi: u.divisi,
        status: statusFinal,
        waktuLapor: found?.waktuLapor || "-",
        fotoSekre: fotoSekreAktif,
        checklistTugas: found?.checklistTugas || [],
        jenisIzin: found?.jenisIzin || null,
        alasanIzin: found?.alasanIzin || null,
        fotoBuktiIzin: fotoIzinAktif,
        isToday,
      });
    });

    return {
      userId: u.id,
      nim: u.nim,
      nama: u.nama,
      divisi: u.divisi,
      jadwalMingguIni: hariTugasMingguIni.join(", ") || "-",
      totalWajib: hadir + izin + alfa + belumAbsen,
      hadir,
      izin,
      alfa,
      belumAbsen,
      riwayatHari,
    };
  });

  detailLogs.sort((a, b) =>
    a.tanggal === b.tanggal ? a.nama.localeCompare(b.nama) : b.tanggal.localeCompare(a.tanggal)
  );

  return NextResponse.json({ detailLogs, rekapUser });
}