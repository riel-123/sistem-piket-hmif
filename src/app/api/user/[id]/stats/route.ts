import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
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

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const userId = Number(id);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { jadwalPiket: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    const nowWib = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const yyyy = nowWib.getFullYear();
    const mm = String(nowWib.getMonth() + 1).padStart(2, "0");
    const dd = String(nowWib.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const startMonthStr = `${yyyy}-${mm}-01`;
    const isAfter5PM = nowWib.getHours() >= 17;

    // Senin minggu berjalan
    const mondayDate = new Date(nowWib);
    const day = mondayDate.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    mondayDate.setDate(mondayDate.getDate() + diffToMonday);
    const currentWeekMondayStr = `${mondayDate.getFullYear()}-${String(
      mondayDate.getMonth() + 1
    ).padStart(2, "0")}-${String(mondayDate.getDate()).padStart(2, "0")}`;

    const presensiBulanIni = await prisma.presensi.findMany({
      where: {
        userId,
        tanggal: { gte: startMonthStr, lte: todayStr },
      },
    });

    const hariTugasMingguIni = user.jadwalPiket.map((j) => j.hari);
    let hadir = 0;
    let izin = 0;
    let alfa = 0;

    const curr = new Date(`${startMonthStr}T00:00:00+07:00`);
    const end = new Date(`${todayStr}T00:00:00+07:00`);

    while (curr <= end) {
      const namaHari = HARI_MAP[curr.getDay()];
      if (namaHari) {
        const cY = curr.getFullYear();
        const cM = String(curr.getMonth() + 1).padStart(2, "0");
        const cD = String(curr.getDate()).padStart(2, "0");
        const tglStr = `${cY}-${cM}-${cD}`;

        const found = presensiBulanIni.find((p) => p.tanggal === tglStr);
        const isCurrentWeek = tglStr >= currentWeekMondayStr;

        if (!isCurrentWeek) {
          if (found) {
            if (found.status === "hadir") hadir++;
            else if (found.status === "izin") izin++;
            else if (found.status === "alfa") alfa++;
          }
        } else if (hariTugasMingguIni.includes(namaHari)) {
          if (found) {
            if (found.status === "hadir") hadir++;
            else if (found.status === "izin") izin++;
            else if (found.status === "alfa") alfa++;
          } else if (tglStr < todayStr || (tglStr === todayStr && isAfter5PM)) {
            alfa++;
          }
        }
      }
      curr.setDate(curr.getDate() + 1);
    }

    const totalSelesai = hadir + izin + alfa;
    const persentase = totalSelesai === 0 ? 100 : Math.round((hadir / totalSelesai) * 100);

    return NextResponse.json({
      hadir,
      izin,
      alfa,
      totalSelesai,
      persentase,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal menghitung statistik kehadiran" }, { status: 500 });
  }
}