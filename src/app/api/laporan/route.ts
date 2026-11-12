import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { HariPiket } from "@prisma/client";

// Sistem resmi mulai berlaku Jumat, 13 November 2026 (hari sebelumnya tidak dihitung Alfa)
const TANGGAL_MULAI_EFEKTIF = "2026-11-13";

const HARI_MAP: Record<number, HariPiket | null> = {
  0: null,
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: null,
};

function formatWibDateStr(dateInput: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dateInput);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function getWibContext() {
  const now = new Date();
  const todayStr = formatWibDateStr(now);

  const hourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    hour12: false,
  }).format(now);
  const isAfter5PM = Number(hourStr) >= 17;

  const [y, m, d] = todayStr.split("-").map(Number);
  const wibMidnight = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dayOfWeek = wibMidnight.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  wibMidnight.setUTCDate(wibMidnight.getUTCDate() + diffToMonday);

  const currentWeekMondayStr = `${wibMidnight.getUTCFullYear()}-${String(
    wibMidnight.getUTCMonth() + 1
  ).padStart(2, "0")}-${String(wibMidnight.getUTCDate()).padStart(2, "0")}`;

  return { todayStr, isAfter5PM, currentWeekMondayStr };
}

function getDatesInRange(startStr: string, endStr: string) {
  const dates: { tanggal: string; hari: HariPiket }[] = [];
  const [sy, sm, sd] = startStr.split("-").map(Number);
  const [ey, em, ed] = endStr.split("-").map(Number);

  const curr = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0));
  const end = new Date(Date.UTC(ey, em - 1, ed, 12, 0, 0));

  while (curr <= end) {
    const namaHari = HARI_MAP[curr.getUTCDay()];
    if (namaHari) {
      const yyyy = curr.getUTCFullYear();
      const mm = String(curr.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(curr.getUTCDate()).padStart(2, "0");
      dates.push({ tanggal: `${yyyy}-${mm}-${dd}`, hari: namaHari });
    }
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

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

    let hadir = 0;
    let izin = 0;
    let alfa = 0;
    let belumAbsen = 0;
    const riwayatHari: { tanggal: string; hari: string; status: string }[] = [];

    activeDates.forEach(({ tanggal, hari }) => {
      // Abaikan tanggal sebelum sistem resmi dimulai (sebelum 13 Nov 2026) jika tidak ada catatan presensi
      const found = u.presensi.find((p) => p.tanggal === tanggal);
      if (tanggal < TANGGAL_MULAI_EFEKTIF && !found) return;

      const isCurrentWeek = tanggal >= currentWeekMondayStr;

      if (!isCurrentWeek) {
        if (!found) return;
      } else {
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