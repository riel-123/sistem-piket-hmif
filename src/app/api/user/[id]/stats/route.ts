import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { HariPiket } from "@prisma/client";

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

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const userId = Number(id);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        jadwalPiket: true,
        presensi: true,
      },
    });

    if (!user) {
      return NextResponse.json({ hadir: 0, izin: 0, alfa: 0, totalSelesai: 0, persentase: 100 });
    }

    const now = new Date();
    const todayStr = formatWibDateStr(now);
    const hourStr = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      hour12: false,
    }).format(now);
    const isAfter5PM = Number(hourStr) >= 17;

    const monthStartStr = `${todayStr.slice(0, 7)}-01`;
    const effectiveStartStr =
      monthStartStr < TANGGAL_MULAI_EFEKTIF ? TANGGAL_MULAI_EFEKTIF : monthStartStr;

    const [sy, sm, sd] = effectiveStartStr.split("-").map(Number);
    const [ey, em, ed] = todayStr.split("-").map(Number);

    const curr = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0));
    const end = new Date(Date.UTC(ey, em - 1, ed, 12, 0, 0));

    const hariTugas = user.jadwalPiket.map((j) => j.hari);
    let hadir = 0;
    let izin = 0;
    let alfa = 0;

    while (curr <= end) {
      const namaHari = HARI_MAP[curr.getUTCDay()];
      const tglStr = `${curr.getUTCFullYear()}-${String(curr.getUTCMonth() + 1).padStart(
        2,
        "0"
      )}-${String(curr.getUTCDate()).padStart(2, "0")}`;

      if (namaHari && hariTugas.includes(namaHari)) {
        const found = user.presensi.find((p) => p.tanggal === tglStr);
        if (found) {
          if (found.status === "hadir") hadir++;
          else if (found.status === "izin") izin++;
          else if (found.status === "alfa") alfa++;
        } else if (tglStr < todayStr || (tglStr === todayStr && isAfter5PM)) {
          alfa++;
        }
      }
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    const totalSelesai = hadir + izin + alfa;
    const persentase = totalSelesai === 0 ? 100 : Math.round((hadir / totalSelesai) * 100);

    return NextResponse.json({ hadir, izin, alfa, totalSelesai, persentase });
  } catch (error) {
    console.error("Error stats:", error);
    return NextResponse.json({ hadir: 0, izin: 0, alfa: 0, totalSelesai: 0, persentase: 100 });
  }
}