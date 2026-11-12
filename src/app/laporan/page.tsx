"use client";

import React, { useEffect, useState } from "react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";
import * as XLSX from "xlsx";
import {
  Copy,
  Download,
  Eye,
  Calendar,
  Check,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Users,
  Shuffle,
  Lock,
  Sparkles,
  Building2,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const HARI_ORDER = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];

const DEPARTEMEN_HMIF = [
  "Sekretaris 1",
  "Sekretaris 2",
  "Bendahara 1",
  "Bendahara 2",
  "PSDMO",
  "KASTRAD",
  "PENROH",
  "MEDKOMINFO",
  "KEWIRAUSAHAAN",
  "ORKESMA",
];

export default function LaporanPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<any | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // 1. State KHUSUS DETAIL LOG (Harian Saja)
  const [logDate, setLogDate] = useState<string>("");
  const [detailLogs, setDetailLogs] = useState<any[]>([]);
  const [searchLog, setSearchLog] = useState<string>("");

  // 2. State KHUSUS REKAP KEHADIRAN (Mingguan / Bulanan)
  const [rekapMode, setRekapMode] = useState<"mingguan" | "bulanan">("mingguan");
  const [rekapDate, setRekapDate] = useState<string>("");
  const [rekapMonth, setRekapMonth] = useState<string>("");
  const [rekapUser, setRekapUser] = useState<any[]>([]);
  const [searchRekap, setSearchRekap] = useState<string>("");

  const [previewModal, setPreviewModal] = useState<any | null>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // State Acak & Edit Jadwal
  const [canShuffle, setCanShuffle] = useState(false);
  const [jadwalList, setJadwalList] = useState<any[]>([]);
  const [jadwalTab, setJadwalTab] = useState<"hari" | "departemen">("hari");
  const [shuffling, setShuffling] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [shuffleMsg, setShuffleMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadJadwalStatus = () => {
    fetch("/api/jadwal/acak")
      .then((res) => res.json())
      .then((resData) => {
        setCanShuffle(Boolean(resData.isAllowed));
        setJadwalList(resData.users || []);
      });
  };

  useEffect(() => {
    const saved = localStorage.getItem("piket_user");
    if (!saved) {
      router.replace("/");
      return;
    }

    const parsedUser = JSON.parse(saved);
    if (String(parsedUser.role || "").toLowerCase() !== "admin") {
      router.replace("/");
      return;
    }

    setAdminUser(parsedUser);
    setIsAuthorized(true);
    const now = new Date();
    const todayFormatted = format(now, "yyyy-MM-dd");
    setLogDate(todayFormatted);
    setRekapDate(todayFormatted);
    setRekapMonth(format(now, "yyyy-MM"));
    loadJadwalStatus();
  }, [router]);

  // Fetch Detail Log (Khusus Harian)
  const fetchDetailLogHarian = () => {
    if (!logDate) return;
    fetch(`/api/laporan?start=${logDate}&end=${logDate}`)
      .then((res) => res.json())
      .then((resData) => setDetailLogs(resData.detailLogs || []));
  };

  useEffect(() => {
    if (!isAuthorized) return;
    fetchDetailLogHarian();
  }, [isAuthorized, logDate]);

  // Fetch Rekap Kehadiran (Mingguan / Bulanan)
  const getRekapRange = () => {
    if (!rekapDate || !rekapMonth) return null;
    if (rekapMode === "mingguan") {
      const base = new Date(rekapDate);
      return {
        start: format(startOfWeek(base, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        end: format(endOfWeek(base, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    }
    const baseMonth = new Date(`${rekapMonth}-01`);
    return {
      start: format(startOfMonth(baseMonth), "yyyy-MM-dd"),
      end: format(endOfMonth(baseMonth), "yyyy-MM-dd"),
    };
  };

  const fetchRekapKehadiran = () => {
    const range = getRekapRange();
    if (!range) return;
    fetch(`/api/laporan?start=${range.start}&end=${range.end}`)
      .then((res) => res.json())
      .then((resData) => setRekapUser(resData.rekapUser || []));
  };

  useEffect(() => {
    if (!isAuthorized) return;
    fetchRekapKehadiran();
  }, [isAuthorized, rekapMode, rekapDate, rekapMonth]);

  const handleAcakJadwal = async () => {
    if (!adminUser || !canShuffle) return;
    setShuffleMsg(null);
    setShuffling(true);

    const res = await fetch("/api/jadwal/acak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId: adminUser.id }),
    });
    const resData = await res.json();
    setShuffling(false);

    if (!res.ok) {
      setShuffleMsg({ type: "err", text: resData.error });
    } else {
      setShuffleMsg({ type: "ok", text: resData.message });
      setJadwalList(resData.users || []);
      fetchDetailLogHarian();
      fetchRekapKehadiran();
    }
  };

  const handleManualChangeHari = async (targetUserId: number, hariBaru: string) => {
    if (!adminUser) return;
    setShuffleMsg(null);
    setUpdatingUserId(targetUserId);

    const res = await fetch("/api/jadwal/ubah", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminId: adminUser.id,
        targetUserId,
        hariBaru,
      }),
    });
    const resData = await res.json();
    setUpdatingUserId(null);

    if (!res.ok) {
      setShuffleMsg({ type: "err", text: resData.error });
    } else {
      setShuffleMsg({ type: "ok", text: resData.message });
      setJadwalList(resData.users || []);
      fetchDetailLogHarian();
      fetchRekapKehadiran();
    }
  };

  // =========================================================================
  // SHARE WHATSAPP: KHUSUS JADWAL PER HARI & PER DEPARTEMEN
  // =========================================================================
  const copyJadwalWAPerHari = () => {
    const perHariLines = HARI_ORDER.map((hari) => {
      const anggotaHariIni = jadwalList.filter((u) => u.hari === hari);
      const daftarNama = anggotaHariIni.length
        ? anggotaHariIni.map((u) => `• ${u.nama} (${u.divisi})`).join("\n")
        : "• -";
      return `*${hari.toUpperCase()}:*\n${daftarNama}`;
    });

    const text = `*JADWAL PIKET SEKRE HMIF (PER HARI)*\n\n${perHariLines.join("\n\n")}`;
    navigator.clipboard.writeText(text);
    setCopiedType("wa_hari");
    setShuffleMsg({ type: "ok", text: "Jadwal piket (Per Hari) berhasil disalin untuk WhatsApp!" });
    setTimeout(() => setCopiedType(null), 2500);
  };

  const copyJadwalWAPerDepartemen = () => {
    const daftarDept = Array.from(
      new Set([...DEPARTEMEN_HMIF, ...jadwalList.map((u) => u.divisi)])
    );

    const perDeptLines = daftarDept.map((dept) => {
      const anggotaDept = jadwalList.filter(
        (u) => u.divisi.toLowerCase() === dept.toLowerCase()
      );
      const daftarNama = anggotaDept.length
        ? anggotaDept.map((u) => `• ${u.nama} — *${u.hari}*`).join("\n")
        : "• -";
      return `*${dept.toUpperCase()}:*\n${daftarNama}`;
    });

    const text = `*JADWAL PIKET SEKRE HMIF (PER DEPARTEMEN)*\n\n${perDeptLines.join("\n\n")}`;
    navigator.clipboard.writeText(text);
    setCopiedType("wa_dept");
    setShuffleMsg({
      type: "ok",
      text: "Jadwal piket (Per Departemen) berhasil disalin untuk WhatsApp!",
    });
    setTimeout(() => setCopiedType(null), 2500);
  };

  // =========================================================================
  // COPY EXCEL (TSV): KHUSUS REKAP KEHADIRAN & DETAIL LOG HARIAN
  // =========================================================================
  const copyRekapKehadiranExcel = () => {
    const header = [
      "No",
      "NIM",
      "Nama Pengurus",
      "Departemen",
      "Hadir",
      "Izin",
      "Alfa",
      "Rincian Hari Piket",
    ].join("\t");

    const rows = rekapUser.map((u, idx) => {
      const rincian = (u.riwayatHari || [])
        .map(
          (r: any) =>
            `${r.hari} (${r.tanggal}): ${
              r.status === "belum_absen" ? "TERJADWAL" : r.status.toUpperCase()
            }`
        )
        .join("; ");
      return [
        idx + 1,
        u.nim,
        u.nama,
        u.divisi,
        u.hadir,
        u.izin,
        u.alfa,
        rincian || "-",
      ].join("\t");
    });

    navigator.clipboard.writeText([header, ...rows].join("\n"));
    setCopiedType("rekap_excel");
    setShuffleMsg({
      type: "ok",
      text: `Tabel Rekap Kehadiran (${rekapMode}) tersalin! Tinggal Ctrl+V di Excel / Google Sheets.`,
    });
    setTimeout(() => setCopiedType(null), 2500);
  };

  const copyLogHarianExcel = () => {
    const header = [
      "No",
      "Tanggal",
      "Hari",
      "NIM",
      "Nama Pengurus",
      "Departemen",
      "Status",
      "Jam Lapor",
      "Keterangan Izin",
    ].join("\t");

    const rows = detailLogs.map((l, idx) =>
      [
        idx + 1,
        l.tanggal,
        l.hari,
        l.nim,
        l.nama,
        l.divisi,
        l.status.replace("_", " ").toUpperCase(),
        l.waktuLapor,
        l.jenisIzin ? `${l.jenisIzin}: ${l.alasanIzin}` : "-",
      ].join("\t")
    );

    navigator.clipboard.writeText([header, ...rows].join("\n"));
    setCopiedType("log_excel");
    setShuffleMsg({
      type: "ok",
      text: "Tabel Detail Log Harian tersalin! Tinggal Ctrl+V di Excel / Google Sheets.",
    });
    setTimeout(() => setCopiedType(null), 2500);
  };

  // =========================================================================
  // DOWNLOAD FILE EXCEL (.XLSX): PER HARI & PER DEPARTEMEN
  // =========================================================================
  const exportExcelPerHari = () => {
    const wb = XLSX.utils.book_new();

    const rowsPerHari: any[] = [];
    HARI_ORDER.forEach((hari) => {
      const members = jadwalList.filter((u) => u.hari === hari);
      members.forEach((m, idx) => {
        rowsPerHari.push({
          Hari_Piket: hari,
          No: idx + 1,
          NIM: m.nim,
          Nama: m.nama,
          Departemen: m.divisi,
        });
      });
    });

    const wsJadwalHari = XLSX.utils.json_to_sheet(rowsPerHari);
    const wsLogHarian = XLSX.utils.json_to_sheet(
      detailLogs.map((l) => ({
        Tanggal: l.tanggal,
        Hari: l.hari,
        NIM: l.nim,
        Nama: l.nama,
        Departemen: l.divisi,
        Status: l.status.toUpperCase(),
        Waktu_Lapor: l.waktuLapor,
        Jenis_Izin: l.jenisIzin || "-",
        Alasan_Izin: l.alasanIzin || "-",
      }))
    );
    const wsRekap = XLSX.utils.json_to_sheet(
      rekapUser.map((u) => ({
        NIM: u.nim,
        Nama: u.nama,
        Departemen: u.divisi,
        Total_Hadir: u.hadir,
        Total_Izin: u.izin,
        Total_Alfa: u.alfa,
        Rincian_Hari: (u.riwayatHari || [])
          .map((r: any) => `${r.hari} (${r.tanggal}): ${r.status.toUpperCase()}`)
          .join("; "),
      }))
    );

    XLSX.utils.book_append_sheet(wb, wsJadwalHari, "Jadwal Per Hari");
    XLSX.utils.book_append_sheet(wb, wsLogHarian, "Detail Log Harian");
    XLSX.utils.book_append_sheet(wb, wsRekap, "Rekap Kehadiran");
    XLSX.writeFile(wb, `Laporan-Piket-Per-Hari-${logDate || "rekap"}.xlsx`);
  };

  const exportExcelPerDepartemen = () => {
    const wb = XLSX.utils.book_new();
    const daftarDept = Array.from(
      new Set([...DEPARTEMEN_HMIF, ...jadwalList.map((u) => u.divisi)])
    );

    const rowsPerDept: any[] = [];
    daftarDept.forEach((dept) => {
      const members = jadwalList.filter(
        (u) => u.divisi.toLowerCase() === dept.toLowerCase()
      );
      members.forEach((m, idx) => {
        const rekapMatch = rekapUser.find((r) => r.userId === m.id);
        rowsPerDept.push({
          Departemen: dept,
          No: idx + 1,
          NIM: m.nim,
          Nama: m.nama,
          Hari_Piket: m.hari,
          Total_Hadir: rekapMatch?.hadir ?? 0,
          Total_Izin: rekapMatch?.izin ?? 0,
          Total_Alfa: rekapMatch?.alfa ?? 0,
          Rincian_Hari_Kehadiran: (rekapMatch?.riwayatHari || [])
            .map((r: any) => `${r.hari} (${r.tanggal}): ${r.status.toUpperCase()}`)
            .join("; "),
        });
      });
    });

    const wsDept = XLSX.utils.json_to_sheet(rowsPerDept);
    const wsLogHarian = XLSX.utils.json_to_sheet(
      detailLogs.map((l) => ({
        Departemen: l.divisi,
        Tanggal: l.tanggal,
        Hari: l.hari,
        NIM: l.nim,
        Nama: l.nama,
        Status: l.status.toUpperCase(),
        Waktu_Lapor: l.waktuLapor,
      }))
    );

    XLSX.utils.book_append_sheet(wb, wsDept, "Jadwal & Rekap Per Departemen");
    XLSX.utils.book_append_sheet(wb, wsLogHarian, "Detail Log Harian");
    XLSX.writeFile(wb, `Laporan-Piket-Per-Departemen-${logDate || "rekap"}.xlsx`);
  };

  if (!isAuthorized) {
    return null;
  }

  const totalHadir = detailLogs.filter((d) => d.status === "hadir").length;
  const totalIzin = detailLogs.filter((d) => d.status === "izin").length;
  const totalAlfa = detailLogs.filter((d) => d.status === "alfa").length;

  const filteredDetailLogs = detailLogs.filter((log) => {
    const q = searchLog.trim().toLowerCase();
    if (!q) return true;
    return (
      log.nama.toLowerCase().includes(q) ||
      String(log.nim).toLowerCase().includes(q) ||
      log.divisi.toLowerCase().includes(q) ||
      log.status.toLowerCase().includes(q)
    );
  });

  const filteredRekapUser = rekapUser.filter((u) => {
    const q = searchRekap.trim().toLowerCase();
    if (!q) return true;
    return (
      u.nama.toLowerCase().includes(q) ||
      String(u.nim).toLowerCase().includes(q) ||
      u.divisi.toLowerCase().includes(q)
    );
  });

  const daftarDepartemenTampil = Array.from(
    new Set([...DEPARTEMEN_HMIF, ...jadwalList.map((u) => u.divisi)])
  );

  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-900 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-700 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-100 hover:text-white bg-white/10 px-3 py-1.5 rounded-lg mb-3 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Form Piket
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Panel Admin & Laporan Piket
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100 mt-1">
              Operasional Senin – Jumat (07.00 – 17.00 WIB) • Foto bukti otomatis terhapus setiap ganti hari
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={copyRekapKehadiranExcel}
              className="bg-emerald-500 hover:bg-emerald-400 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-900/20 transition"
            >
              {copiedType === "rekap_excel" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedType === "rekap_excel" ? "Tersalin (Ctrl+V di Excel)!" : "Copy Tabel Rekap (Excel)"}
            </button>

            <button
              onClick={exportExcelPerHari}
              className="bg-white text-indigo-700 hover:bg-indigo-50 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-900/20 transition"
            >
              <Download className="w-4 h-4" /> Download .XLSX (Per Hari)
            </button>

            <button
              onClick={exportExcelPerDepartemen}
              className="bg-indigo-950/60 hover:bg-indigo-950/80 text-white border border-white/20 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg transition"
            >
              <Download className="w-4 h-4" /> Download .XLSX (Per Dept)
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-4 space-y-6">
        {/* PANEL ACAK & EDIT MANUAL JADWAL PER HARI / DEPARTEMEN (SHARE WA) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold">
                  <Sparkles className="w-3 h-3" /> MANAJEMEN JADWAL MINGGUAN
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    canShuffle ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {canShuffle ? "Jendela Acak Terbuka" : "Acak Terkunci (Hari Kerja)"}
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 mt-1.5">
                Jadwal Piket Per Hari & Per Departemen
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Bagikan jadwal piket mingguan ke grup WhatsApp berdasarkan hari atau departemen, serta ubah jadwal pengurus secara manual kapan saja.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={copyJadwalWAPerHari}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                {copiedType === "wa_hari" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                Share WA (Per Hari)
              </button>

              <button
                type="button"
                onClick={copyJadwalWAPerDepartemen}
                className="bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                {copiedType === "wa_dept" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                Share WA (Per Departemen)
              </button>

              <button
                type="button"
                disabled={!canShuffle || shuffling}
                onClick={handleAcakJadwal}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition"
              >
                {canShuffle ? <Shuffle className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                {shuffling ? "Mengacak..." : "Acak Jadwal"}
              </button>
            </div>
          </div>

          {shuffleMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold border ${
                shuffleMsg.type === "ok"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-700"
              }`}
            >
              {shuffleMsg.text}
            </div>
          )}

          {/* Switcher Tampilan Per Hari vs Per Departemen */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setJadwalTab("hari")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  jadwalTab === "hari" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600"
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Tampilan Per Hari
              </button>
              <button
                type="button"
                onClick={() => setJadwalTab("departemen")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  jadwalTab === "departemen"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" /> Tampilan Per Departemen
              </button>
            </div>
            <span className="hidden sm:inline text-[11px] text-slate-400">
              Ubah dropdown hari pada kartu anggota untuk penyesuaian manual
            </span>
          </div>

          {/* GRID 1: TAMPILAN PER HARI (SENIN - JUMAT) + DROPDOWN EDIT */}
          {jadwalTab === "hari" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {HARI_ORDER.map((hari) => {
                const members = jadwalList.filter((u) => u.hari === hari);
                return (
                  <div key={hari} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                    <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-200">
                      <span className="font-extrabold text-xs text-indigo-700 uppercase tracking-wider">
                        {hari}
                      </span>
                      <span className="text-[11px] font-bold bg-white px-2 py-0.5 rounded-md border text-slate-600">
                        {members.length} org
                      </span>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {members.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Kosong</p>
                      ) : (
                        members.map((m) => (
                          <div
                            key={m.id}
                            className="bg-white p-2.5 rounded-lg border border-slate-200/70 space-y-1.5"
                          >
                            <div>
                              <p className="text-xs font-bold text-slate-800 leading-snug">
                                {m.nama}
                              </p>
                              <p className="text-[10px] font-semibold text-indigo-600">
                                {m.divisi}
                              </p>
                            </div>
                            <select
                              value={m.hari}
                              disabled={updatingUserId === m.id}
                              onChange={(e) => handleManualChangeHari(m.id, e.target.value)}
                              className="w-full text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:border-indigo-500 outline-none"
                            >
                              {HARI_ORDER.map((h) => (
                                <option key={h} value={h}>
                                  Pindah ke: {h}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* GRID 2: TAMPILAN PER DEPARTEMEN HMIF + DROPDOWN EDIT */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {daftarDepartemenTampil.map((dept) => {
                const members = jadwalList.filter(
                  (u) => u.divisi.toLowerCase() === dept.toLowerCase()
                );
                return (
                  <div
                    key={dept}
                    className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5"
                  >
                    <div className="flex justify-between items-center pb-2 mb-2.5 border-b border-slate-200">
                      <span className="font-extrabold text-xs text-violet-700 uppercase tracking-wider">
                        {dept}
                      </span>
                      <span className="text-[11px] font-bold bg-white px-2 py-0.5 rounded-md border text-slate-600">
                        {members.length} org
                      </span>
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {members.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Belum ada anggota terdaftar</p>
                      ) : (
                        members.map((m) => (
                          <div
                            key={m.id}
                            className="bg-white p-2.5 rounded-lg border border-slate-200/70 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{m.nama}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{m.nim}</p>
                            </div>
                            <select
                              value={m.hari === "-" ? "Senin" : m.hari}
                              disabled={updatingUserId === m.id}
                              onChange={(e) => handleManualChangeHari(m.id, e.target.value)}
                              className="text-[11px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg px-2 py-1.5 outline-none shrink-0"
                            >
                              {HARI_ORDER.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* POSISI ATAS: DETAIL LOG KEHADIRAN HARIAN (KHUSUS HARIAN SAJA)   */}
        {/* ============================================================== */}
        <div className="space-y-4">
          {/* 4 Summary Cards Harian */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Jadwal Hari Ini</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{detailLogs.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Hadir Piket</p>
                <p className="text-2xl font-extrabold text-emerald-600 mt-1">{totalHadir}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Izin Resmi</p>
                <p className="text-2xl font-extrabold text-amber-600 mt-1">{totalIzin}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Alfa / Absen</p>
                <p className="text-2xl font-extrabold text-rose-600 mt-1">{totalAlfa}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <XCircle className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <span className="font-extrabold text-slate-800 text-sm sm:text-base block">
                  Detail Log Kehadiran Harian ({filteredDetailLogs.length} Catatan)
                </span>
                <span className="text-[11px] text-slate-400">
                  *Khusus monitoring harian • Foto bukti berlaku 1 hari dan otomatis terhapus saat berganti hari
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {/* Copy Tabel Log Harian ke Excel */}
                <button
                  type="button"
                  onClick={copyLogHarianExcel}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shrink-0"
                >
                  {copiedType === "log_excel" ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedType === "log_excel" ? "Tersalin!" : "Copy Tabel Log (Excel)"}
                </button>

                {/* Pencarian Detail Log */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchLog}
                    onChange={(e) => setSearchLog(e.target.value)}
                    placeholder="Cari nama, NIM, dept, status..."
                    className="w-full sm:w-52 border border-slate-200 focus:border-indigo-500 outline-none rounded-xl pl-9 pr-3 py-2 text-xs font-medium bg-slate-50"
                  />
                </div>

                {/* Pemilih Tanggal Khusus Harian */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                  <input
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="bg-transparent text-xs sm:text-sm font-semibold text-slate-800 outline-none w-full"
                  />
                </div>
              </div>
            </div>

            {filteredDetailLogs.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">
                Tidak ada log piket yang sesuai pada tanggal ini (Sabtu & Minggu libur).
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="p-3.5">Hari & Tanggal</th>
                      <th className="p-3.5">Pengurus</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Jam</th>
                      <th className="p-3.5">Dokumentasi (Hari Ini)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDetailLogs.map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5 whitespace-nowrap text-xs sm:text-sm text-slate-600">
                          <span className="font-semibold text-slate-800">{log.hari}</span>, {log.tanggal}
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">{log.nama}</div>
                          <div className="text-[11px] text-slate-400">
                            {log.nim} • {log.divisi}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                              log.status === "hadir"
                                ? "bg-emerald-100 text-emerald-700"
                                : log.status === "izin"
                                ? "bg-amber-100 text-amber-700"
                                : log.status === "alfa"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {log.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-3.5 text-xs font-mono text-slate-600">{log.waktuLapor}</td>
                        <td className="p-3.5">
                          {log.fotoSekre || log.fotoBuktiIzin ? (
                            <button
                              onClick={() => setPreviewModal(log)}
                              className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                            >
                              <Eye className="w-3.5 h-3.5" /> Lihat Bukti
                            </button>
                          ) : log.status === "hadir" || log.status === "izin" ? (
                            <span className="text-slate-400 text-[11px] italic">
                              Foto terhapus (hari sebelumnya)
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* POSISI BAWAH: REKAP KEHADIRAN PER PENGURUS (MINGGUAN / BULANAN) */}
        {/* ============================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="font-extrabold text-slate-800 text-sm sm:text-base">
                Rekap Kehadiran Per Pengurus ({rekapMode === "mingguan" ? "Mingguan" : "Bulanan"})
              </h2>
              <p className="text-xs text-slate-400">
                Menampilkan total kehadiran tiap anggota beserta rincian hari piketnya
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Copy Tabel Rekap Langsung ke Excel */}
              <button
                type="button"
                onClick={copyRekapKehadiranExcel}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                {copiedType === "rekap_excel" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                Copy Tabel Rekap (Excel)
              </button>

              {/* Pencarian Rekap Kehadiran */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchRekap}
                  onChange={(e) => setSearchRekap(e.target.value)}
                  placeholder="Cari nama, NIM, dept..."
                  className="w-full sm:w-48 border border-slate-200 focus:border-indigo-500 outline-none rounded-xl pl-9 pr-3 py-2 text-xs font-medium bg-slate-50"
                />
              </div>

              {/* Filter Mingguan / Bulanan */}
              <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setRekapMode("mingguan")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    rekapMode === "mingguan"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Mingguan
                </button>
                <button
                  type="button"
                  onClick={() => setRekapMode("bulanan")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    rekapMode === "bulanan"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Bulanan
                </button>
              </div>

              {/* Pemilih Minggu / Bulan */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                {rekapMode === "bulanan" ? (
                  <input
                    type="month"
                    value={rekapMonth}
                    onChange={(e) => setRekapMonth(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-800 outline-none w-full"
                  />
                ) : (
                  <input
                    type="date"
                    value={rekapDate}
                    onChange={(e) => setRekapDate(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-800 outline-none w-full"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="p-3.5">Nama / Departemen</th>
                  <th className="p-3.5 text-center text-emerald-600">Hadir</th>
                  <th className="p-3.5 text-center text-amber-600">Izin</th>
                  <th className="p-3.5 text-center text-rose-600">Alfa</th>
                  <th className="p-3.5">Hari Piket / Kehadiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRekapUser.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-xs text-slate-400">
                      Tidak ada pengurus yang cocok dengan kata kunci pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredRekapUser.map((u) => (
                    <tr key={u.userId} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{u.nama}</div>
                        <div className="text-xs text-slate-500">
                          {u.nim} • {u.divisi}
                        </div>
                      </td>
                      <td className="p-3.5 text-center font-extrabold text-emerald-600">
                        {u.hadir}x
                      </td>
                      <td className="p-3.5 text-center font-extrabold text-amber-600">
                        {u.izin}x
                      </td>
                      <td className="p-3.5 text-center font-extrabold text-rose-600">
                        {u.alfa}x
                      </td>
                      <td className="p-3.5">
                        {u.riwayatHari && u.riwayatHari.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {u.riwayatHari.map((r: any, i: number) => (
                              <span
                                key={i}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                                  r.status === "hadir"
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    : r.status === "izin"
                                    ? "bg-amber-50 border-amber-200 text-amber-700"
                                    : r.status === "alfa"
                                    ? "bg-rose-50 border-rose-200 text-rose-700"
                                    : "bg-slate-50 border-slate-200 text-slate-600"
                                }`}
                              >
                                {r.hari} ({r.tanggal.slice(5)}) •{" "}
                                {r.status === "belum_absen" ? "Terjadwal" : r.status.toUpperCase()}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Belum ada jadwal/catatan</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Preview Bukti Foto */}
        {previewModal && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                    Dokumentasi {previewModal.status === "izin" ? "Izin" : "Piket Sekre"}
                  </span>
                  <h3 className="font-extrabold text-lg text-slate-900">{previewModal.nama}</h3>
                </div>
                <button
                  onClick={() => setPreviewModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold"
                >
                  ✕
                </button>
              </div>
              <img
                src={previewModal.fotoSekre || previewModal.fotoBuktiIzin}
                alt="Bukti"
                className="w-full rounded-2xl border border-slate-200 max-h-80 object-contain bg-slate-50"
              />
              {previewModal.status === "izin" ? (
                <div className="text-xs sm:text-sm bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-2xl space-y-1">
                  <p>
                    <strong>Kategori:</strong> {previewModal.jenisIzin}
                  </p>
                  <p>
                    <strong>Alasan:</strong> {previewModal.alasanIzin}
                  </p>
                </div>
              ) : (
                <div className="text-xs sm:text-sm bg-emerald-50 border border-emerald-200 text-emerald-900 p-3.5 rounded-2xl">
                  <strong>Tugas Selesai:</strong>{" "}
                  {(previewModal.checklistTugas || []).join(", ") || "-"}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}