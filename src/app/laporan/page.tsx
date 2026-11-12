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
  ArrowLeftRight,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const HARI_ORDER = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];

const DEPARTEMEN_HMIF = [
  "Ketua",
  "Wakil Ketua",
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

function getTodayWibFormatted(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

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

  // 3. State LAPORAN TUKAR JADWAL (Admin Monitoring)
  const [allTukarList, setAllTukarList] = useState<any[]>([]);
  const [searchTukarLog, setSearchTukarLog] = useState<string>("");

  // 4. State MODAL TAMBAH ANGGOTA BARU
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newNim, setNewNim] = useState("");
  const [newNama, setNewNama] = useState("");
  const [newDivisi, setNewDivisi] = useState(DEPARTEMEN_HMIF[4]);
  const [newPassword, setNewPassword] = useState("hmif2026");
  const [newRole, setNewRole] = useState<"pengurus" | "admin">("pengurus");
  const [newHari, setNewHari] = useState("Senin");
  const [addingUser, setAddingUser] = useState(false);
  const [addUserErr, setAddUserErr] = useState("");

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

  const loadLaporanTukar = () => {
    fetch("/api/tukar?mode=admin")
      .then((res) => res.json())
      .then((resData) => {
        setAllTukarList(resData.allTukar || []);
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
    const todayFormatted = getTodayWibFormatted();
    setLogDate(todayFormatted);
    setRekapDate(todayFormatted);
    setRekapMonth(todayFormatted.slice(0, 7));
    loadJadwalStatus();
    loadLaporanTukar();
  }, [router]);

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

  const getRekapRange = () => {
    if (!rekapDate || !rekapMonth) return null;
    if (rekapMode === "mingguan") {
      const [y, m, d] = rekapDate.split("-").map(Number);
      const base = new Date(y, m - 1, d, 12, 0, 0);
      return {
        start: format(startOfWeek(base, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        end: format(endOfWeek(base, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    }
    const [my, mm] = rekapMonth.split("-").map(Number);
    const baseMonth = new Date(my, mm - 1, 1, 12, 0, 0);
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

  const handleTambahAnggota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUser) return;
    setAddUserErr("");
    setAddingUser(true);

    const res = await fetch("/api/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminId: adminUser.id,
        nim: newNim,
        nama: newNama,
        divisi: newDivisi,
        password: newPassword,
        role: newRole,
        hari: newHari,
      }),
    });
    const resData = await res.json();
    setAddingUser(false);

    if (!res.ok) {
      setAddUserErr(resData.error);
    } else {
      setShuffleMsg({ type: "ok", text: resData.message });
      setNewNim("");
      setNewNama("");
      setNewPassword("hmif2026");
      setNewRole("pengurus");
      setShowAddUserModal(false);
      loadJadwalStatus();
      fetchDetailLogHarian();
      fetchRekapKehadiran();
    }
  };

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

  // SHARE WHATSAPP: JADWAL PER HARI & PER DEPARTEMEN
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

  // COPY EXCEL (TSV)
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

  const copyTukarJadwalExcel = () => {
    const header = [
      "No",
      "Waktu Pengajuan",
      "Pemohon",
      "NIM Pemohon",
      "Hari Pemohon",
      "Penerima Tukar",
      "NIM Penerima",
      "Hari Penerima",
      "Alasan",
      "Status",
    ].join("\t");

    const rows = allTukarList.map((t, idx) =>
      [
        idx + 1,
        format(new Date(t.createdAt), "yyyy-MM-dd HH:mm"),
        t.pemohon.nama,
        t.pemohon.nim,
        t.hariPemohon,
        t.tujuan.nama,
        t.tujuan.nim,
        t.hariTujuan,
        t.alasan.replace(/\s+/g, " "),
        t.status.toUpperCase(),
      ].join("\t")
    );

    navigator.clipboard.writeText([header, ...rows].join("\n"));
    setCopiedType("tukar_excel");
    setShuffleMsg({
      type: "ok",
      text: "Tabel Laporan Tukar Jadwal tersalin! Tinggal Ctrl+V di Excel / Google Sheets.",
    });
    setTimeout(() => setCopiedType(null), 2500);
  };

  // DOWNLOAD FILE EXCEL (.XLSX)
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
    const wsTukar = XLSX.utils.json_to_sheet(
      allTukarList.map((t) => ({
        Waktu: format(new Date(t.createdAt), "yyyy-MM-dd HH:mm"),
        Pemohon: t.pemohon.nama,
        NIM_Pemohon: t.pemohon.nim,
        Hari_Pemohon: t.hariPemohon,
        Penerima: t.tujuan.nama,
        NIM_Penerima: t.tujuan.nim,
        Hari_Penerima: t.hariTujuan,
        Alasan: t.alasan,
        Status: t.status.toUpperCase(),
      }))
    );

    XLSX.utils.book_append_sheet(wb, wsJadwalHari, "Jadwal Per Hari");
    XLSX.utils.book_append_sheet(wb, wsLogHarian, "Detail Log Harian");
    XLSX.utils.book_append_sheet(wb, wsRekap, "Rekap Kehadiran");
    XLSX.utils.book_append_sheet(wb, wsTukar, "Laporan Tukar Jadwal");
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
    const wsTukar = XLSX.utils.json_to_sheet(
      allTukarList.map((t) => ({
        Waktu: format(new Date(t.createdAt), "yyyy-MM-dd HH:mm"),
        Pemohon: t.pemohon.nama,
        NIM_Pemohon: t.pemohon.nim,
        Hari_Pemohon: t.hariPemohon,
        Penerima: t.tujuan.nama,
        NIM_Penerima: t.tujuan.nim,
        Hari_Penerima: t.hariTujuan,
        Alasan: t.alasan,
        Status: t.status.toUpperCase(),
      }))
    );

    XLSX.utils.book_append_sheet(wb, wsDept, "Jadwal & Rekap Per Departemen");
    XLSX.utils.book_append_sheet(wb, wsTukar, "Laporan Tukar Jadwal");
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

  const filteredTukarList = allTukarList.filter((t) => {
    const q = searchTukarLog.trim().toLowerCase();
    if (!q) return true;
    return (
      t.pemohon.nama.toLowerCase().includes(q) ||
      String(t.pemohon.nim).toLowerCase().includes(q) ||
      t.tujuan.nama.toLowerCase().includes(q) ||
      String(t.tujuan.nim).toLowerCase().includes(q) ||
      t.hariPemohon.toLowerCase().includes(q) ||
      t.hariTujuan.toLowerCase().includes(q) ||
      t.status.toLowerCase().includes(q)
    );
  });

  const daftarDepartemenTampil = Array.from(
    new Set([...DEPARTEMEN_HMIF, ...jadwalList.map((u) => u.divisi)])
  );

  return (
    <div className="min-h-screen bg-stone-100/90 text-stone-900 pb-12">
      {/* Header Banner — Nuansa Oranye Hangat Kalem (Terracotta / Burnt Orange) */}
      <div className="bg-gradient-to-r from-orange-800 via-orange-700 to-amber-700 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-100 hover:text-white bg-white/10 px-3 py-1.5 rounded-lg mb-3 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Form Piket
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Panel Admin & Laporan Piket
            </h1>
            <p className="text-xs sm:text-sm text-orange-100/90 mt-1">
              Operasional Senin – Jumat (07.00 – 17.00 WIB) • Foto bukti otomatis terhapus setiap ganti hari
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setAddUserErr("");
                setShowAddUserModal(true);
              }}
              className="bg-amber-100 hover:bg-amber-200 text-orange-950 px-3.5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md transition"
            >
              <UserPlus className="w-4 h-4 text-orange-800" /> + Tambah Anggota
            </button>

            <button
              onClick={copyRekapKehadiranExcel}
              className="bg-emerald-700 hover:bg-emerald-600 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition"
            >
              {copiedType === "rekap_excel" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedType === "rekap_excel" ? "Tersalin (Ctrl+V di Excel)!" : "Copy Tabel Rekap (Excel)"}
            </button>

            <button
              onClick={exportExcelPerHari}
              className="bg-white text-orange-900 hover:bg-orange-50 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition"
            >
              <Download className="w-4 h-4" /> Download .XLSX (Per Hari)
            </button>

            <button
              onClick={exportExcelPerDepartemen}
              className="bg-orange-950/60 hover:bg-orange-950/80 text-orange-50 border border-orange-300/25 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition"
            >
              <Download className="w-4 h-4" /> Download .XLSX (Per Dept)
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-4 space-y-6">
        {/* PANEL ACAK & EDIT MANUAL JADWAL PER HARI / DEPARTEMEN (SHARE WA) */}
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-5 sm:p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[11px] font-bold">
                  <Sparkles className="w-3 h-3" /> MANAJEMEN JADWAL MINGGUAN
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    canShuffle ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {canShuffle ? "Jendela Acak Terbuka" : "Acak Terkunci (Hari Kerja)"}
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-stone-900 mt-1.5">
                Jadwal Piket Per Hari & Per Departemen
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Bagikan jadwal piket mingguan ke grup WhatsApp berdasarkan hari atau departemen, serta ubah jadwal pengurus secara manual kapan saja.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={copyJadwalWAPerHari}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
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
                className="bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
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
                className="bg-gradient-to-r from-orange-700 to-amber-700 hover:from-orange-800 hover:to-amber-800 disabled:from-stone-300 disabled:to-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
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
          <div className="flex items-center justify-between border-t border-stone-100 pt-4">
            <div className="grid grid-cols-2 bg-stone-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setJadwalTab("hari")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  jadwalTab === "hari" ? "bg-white text-orange-800 shadow-sm" : "text-stone-600"
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Tampilan Per Hari
              </button>
              <button
                type="button"
                onClick={() => setJadwalTab("departemen")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  jadwalTab === "departemen"
                    ? "bg-white text-orange-800 shadow-sm"
                    : "text-stone-600"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" /> Tampilan Per Departemen
              </button>
            </div>
            <span className="hidden sm:inline text-[11px] text-stone-400">
              Ubah dropdown hari pada kartu anggota untuk penyesuaian manual
            </span>
          </div>

          {jadwalTab === "hari" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {HARI_ORDER.map((hari) => {
                const members = jadwalList.filter((u) => u.hari === hari);
                return (
                  <div key={hari} className="bg-stone-50 border border-stone-200/80 rounded-xl p-3">
                    <div className="flex justify-between items-center pb-2 mb-2 border-b border-stone-200">
                      <span className="font-extrabold text-xs text-orange-800 uppercase tracking-wider">
                        {hari}
                      </span>
                      <span className="text-[11px] font-bold bg-white px-2 py-0.5 rounded-md border border-stone-200 text-stone-600">
                        {members.length} org
                      </span>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {members.length === 0 ? (
                        <p className="text-xs text-stone-400 italic">Kosong</p>
                      ) : (
                        members.map((m) => (
                          <div
                            key={m.id}
                            className="bg-white p-2.5 rounded-lg border border-stone-200/70 space-y-1.5"
                          >
                            <div>
                              <p className="text-xs font-bold text-stone-800 leading-snug">
                                {m.nama}
                              </p>
                              <p className="text-[10px] font-semibold text-orange-700">
                                {m.divisi}
                              </p>
                            </div>
                            <select
                              value={m.hari}
                              disabled={updatingUserId === m.id}
                              onChange={(e) => handleManualChangeHari(m.id, e.target.value)}
                              className="w-full text-[11px] font-bold bg-stone-50 border border-stone-200 rounded-md px-2 py-1 text-stone-700 focus:border-orange-600 outline-none"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {daftarDepartemenTampil.map((dept) => {
                const members = jadwalList.filter(
                  (u) => u.divisi.toLowerCase() === dept.toLowerCase()
                );
                return (
                  <div
                    key={dept}
                    className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5"
                  >
                    <div className="flex justify-between items-center pb-2 mb-2.5 border-b border-stone-200">
                      <span className="font-extrabold text-xs text-orange-800 uppercase tracking-wider">
                        {dept}
                      </span>
                      <span className="text-[11px] font-bold bg-white px-2 py-0.5 rounded-md border border-stone-200 text-stone-600">
                        {members.length} org
                      </span>
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {members.length === 0 ? (
                        <p className="text-xs text-stone-400 italic">Belum ada anggota terdaftar</p>
                      ) : (
                        members.map((m) => (
                          <div
                            key={m.id}
                            className="bg-white p-2.5 rounded-lg border border-stone-200/70 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-stone-800 truncate">{m.nama}</p>
                              <p className="text-[10px] text-stone-400 font-mono">{m.nim}</p>
                            </div>
                            <select
                              value={m.hari === "-" ? "Senin" : m.hari}
                              disabled={updatingUserId === m.id}
                              onChange={(e) => handleManualChangeHari(m.id, e.target.value)}
                              className="text-[11px] font-extrabold bg-orange-50 text-orange-800 border border-orange-200 rounded-lg px-2 py-1.5 outline-none shrink-0"
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-stone-500">Jadwal Hari Ini</p>
                <p className="text-2xl font-extrabold text-stone-900 mt-1">{detailLogs.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-stone-500">Hadir Piket</p>
                <p className="text-2xl font-extrabold text-emerald-700 mt-1">{totalHadir}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-stone-500">Izin Resmi</p>
                <p className="text-2xl font-extrabold text-amber-700 mt-1">{totalIzin}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-stone-500">Alfa / Absen</p>
                <p className="text-2xl font-extrabold text-rose-700 mt-1">{totalAlfa}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
                <XCircle className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <span className="font-extrabold text-stone-800 text-sm sm:text-base block">
                  Detail Log Kehadiran Harian ({filteredDetailLogs.length} Catatan)
                </span>
                <span className="text-[11px] text-stone-400">
                  *Khusus monitoring harian • Foto bukti berlaku 1 hari dan otomatis terhapus saat berganti hari
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={copyLogHarianExcel}
                  className="bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shrink-0"
                >
                  {copiedType === "log_excel" ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedType === "log_excel" ? "Tersalin!" : "Copy Tabel Log (Excel)"}
                </button>

                <div className="relative">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchLog}
                    onChange={(e) => setSearchLog(e.target.value)}
                    placeholder="Cari nama, NIM, dept, status..."
                    className="w-full sm:w-52 border border-stone-200 focus:border-orange-600 outline-none rounded-xl pl-9 pr-3 py-2 text-xs font-medium bg-stone-50"
                  />
                </div>

                <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2">
                  <Calendar className="w-4 h-4 text-orange-700 shrink-0" />
                  <input
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="bg-transparent text-xs sm:text-sm font-semibold text-stone-800 outline-none w-full"
                  />
                </div>
              </div>
            </div>

            {filteredDetailLogs.length === 0 ? (
              <div className="p-10 text-center text-sm text-stone-400">
                Tidak ada log piket yang sesuai pada tanggal ini (Sabtu & Minggu libur).
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
                    <tr>
                      <th className="p-3.5">Hari & Tanggal</th>
                      <th className="p-3.5">Pengurus</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Jam</th>
                      <th className="p-3.5">Dokumentasi (Hari Ini)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredDetailLogs.map((log, idx) => (
                      <tr key={idx} className="hover:bg-orange-50/30 transition">
                        <td className="p-3.5 whitespace-nowrap text-xs sm:text-sm text-stone-600">
                          <span className="font-semibold text-stone-800">{log.hari}</span>, {log.tanggal}
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-stone-900">{log.nama}</div>
                          <div className="text-[11px] text-stone-400">
                            {log.nim} • {log.divisi}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                              log.status === "hadir"
                                ? "bg-emerald-100 text-emerald-800"
                                : log.status === "izin"
                                ? "bg-amber-100 text-amber-800"
                                : log.status === "alfa"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-stone-100 text-stone-600"
                            }`}
                          >
                            {log.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-3.5 text-xs font-mono text-stone-600">{log.waktuLapor}</td>
                        <td className="p-3.5">
                          {log.fotoSekre || log.fotoBuktiIzin ? (
                            <button
                              onClick={() => setPreviewModal(log)}
                              className="inline-flex items-center gap-1.5 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                            >
                              <Eye className="w-3.5 h-3.5" /> Lihat Bukti
                            </button>
                          ) : log.status === "hadir" || log.status === "izin" ? (
                            <span className="text-stone-400 text-[11px] italic">
                              Foto terhapus (hari sebelumnya)
                            </span>
                          ) : (
                            <span className="text-stone-400 text-xs">-</span>
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
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="font-extrabold text-stone-800 text-sm sm:text-base">
                Rekap Kehadiran Per Pengurus ({rekapMode === "mingguan" ? "Mingguan" : "Bulanan"})
              </h2>
              <p className="text-xs text-stone-400">
                Menampilkan total kehadiran tiap anggota beserta rincian hari piketnya
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyRekapKehadiranExcel}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                {copiedType === "rekap_excel" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                Copy Tabel Rekap (Excel)
              </button>

              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchRekap}
                  onChange={(e) => setSearchRekap(e.target.value)}
                  placeholder="Cari nama, NIM, dept..."
                  className="w-full sm:w-48 border border-stone-200 focus:border-orange-600 outline-none rounded-xl pl-9 pr-3 py-2 text-xs font-medium bg-stone-50"
                />
              </div>

              <div className="grid grid-cols-2 bg-stone-100 p-1 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setRekapMode("mingguan")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    rekapMode === "mingguan"
                      ? "bg-white text-orange-800 shadow-sm"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  Mingguan
                </button>
                <button
                  type="button"
                  onClick={() => setRekapMode("bulanan")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    rekapMode === "bulanan"
                      ? "bg-white text-orange-800 shadow-sm"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  Bulanan
                </button>
              </div>

              <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5">
                <Calendar className="w-4 h-4 text-orange-700 shrink-0" />
                {rekapMode === "bulanan" ? (
                  <input
                    type="month"
                    value={rekapMonth}
                    onChange={(e) => setRekapMonth(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-stone-800 outline-none w-full"
                  />
                ) : (
                  <input
                    type="date"
                    value={rekapDate}
                    onChange={(e) => setRekapDate(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-stone-800 outline-none w-full"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
                <tr>
                  <th className="p-3.5">Nama / Departemen</th>
                  <th className="p-3.5 text-center text-emerald-700">Hadir</th>
                  <th className="p-3.5 text-center text-amber-700">Izin</th>
                  <th className="p-3.5 text-center text-rose-700">Alfa</th>
                  <th className="p-3.5">Hari Piket / Kehadiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredRekapUser.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-xs text-stone-400">
                      Tidak ada pengurus yang cocok dengan kata kunci pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredRekapUser.map((u) => (
                    <tr key={u.userId} className="hover:bg-orange-50/30 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-stone-900">{u.nama}</div>
                        <div className="text-xs text-stone-500">
                          {u.nim} • {u.divisi}
                        </div>
                      </td>
                      <td className="p-3.5 text-center font-extrabold text-emerald-700">
                        {u.hadir}x
                      </td>
                      <td className="p-3.5 text-center font-extrabold text-amber-700">
                        {u.izin}x
                      </td>
                      <td className="p-3.5 text-center font-extrabold text-rose-700">
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
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                    : r.status === "izin"
                                    ? "bg-amber-50 border-amber-200 text-amber-800"
                                    : r.status === "alfa"
                                    ? "bg-rose-50 border-rose-200 text-rose-800"
                                    : "bg-stone-50 border-stone-200 text-stone-600"
                                }`}
                              >
                                {r.hari} ({r.tanggal.slice(5)}) •{" "}
                                {r.status === "belum_absen" ? "Terjadwal" : r.status.toUpperCase()}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-stone-400">Belum ada jadwal/catatan</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ============================================================== */}
        {/* LAPORAN & RIWAYAT TUKAR JADWAL (MONITORING ADMIN)              */}
        {/* ============================================================== */}
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center shrink-0">
                <ArrowLeftRight className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-extrabold text-stone-800 text-sm sm:text-base">
                  Laporan Pertukaran Jadwal ({filteredTukarList.length} Riwayat)
                </h2>
                <p className="text-xs text-stone-400">
                  Merekam setiap pengajuan dan persetujuan tukar hari piket antar pengurus
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button
                type="button"
                onClick={copyTukarJadwalExcel}
                className="bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shrink-0"
              >
                {copiedType === "tukar_excel" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copiedType === "tukar_excel" ? "Tersalin!" : "Copy Tabel Tukar (Excel)"}
              </button>

              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTukarLog}
                  onChange={(e) => setSearchTukarLog(e.target.value)}
                  placeholder="Cari pemohon, NIM, hari, status..."
                  className="w-full sm:w-60 border border-stone-200 focus:border-orange-600 outline-none rounded-xl pl-9 pr-3 py-2 text-xs font-medium bg-stone-50"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
                <tr>
                  <th className="p-3.5">Waktu</th>
                  <th className="p-3.5">Pengaju (Pemohon)</th>
                  <th className="p-3.5">Rekan Tujuan</th>
                  <th className="p-3.5">Pertukaran Hari</th>
                  <th className="p-3.5">Alasan</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredTukarList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-stone-400">
                      Belum ada riwayat pengajuan tukar jadwal.
                    </td>
                  </tr>
                ) : (
                  filteredTukarList.map((t) => (
                    <tr key={t.id} className="hover:bg-orange-50/30 transition">
                      <td className="p-3.5 whitespace-nowrap text-xs font-mono text-stone-500">
                        {format(new Date(t.createdAt), "dd/MM/yyyy HH:mm")}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-stone-900">{t.pemohon.nama}</div>
                        <div className="text-[11px] text-stone-400">
                          {t.pemohon.nim} • {t.pemohon.divisi}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-stone-900">{t.tujuan.nama}</div>
                        <div className="text-[11px] text-stone-400">
                          {t.tujuan.nim} • {t.tujuan.divisi}
                        </div>
                      </td>
                      <td className="p-3.5 whitespace-nowrap text-xs font-bold text-orange-800">
                        {t.hariPemohon} ↔ {t.hariTujuan}
                      </td>
                      <td className="p-3.5 text-xs text-stone-600 max-w-xs">{t.alasan}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                            t.status === "pending"
                              ? "bg-amber-100 text-amber-800"
                              : t.status === "disetujui"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ============================================================== */}
        {/* MODAL TAMBAH ANGGOTA BARU                                      */}
        {/* ============================================================== */}
        {showAddUserModal && (
          <div className="fixed inset-0 bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <form
              onSubmit={handleTambahAnggota}
              className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700">
                    Manajemen Pengurus HMIF
                  </span>
                  <h3 className="font-extrabold text-lg text-stone-900">Tambah Anggota Baru</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 font-bold"
                >
                  ✕
                </button>
              </div>

              {addUserErr && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl font-semibold">
                  {addUserErr}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 uppercase">NIM</label>
                  <input
                    type="text"
                    required
                    value={newNim}
                    onChange={(e) => setNewNim(e.target.value)}
                    placeholder="Contoh: 2350081099"
                    className="w-full mt-1 border border-stone-200 focus:border-orange-600 outline-none rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 uppercase">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={newNama}
                    onChange={(e) => setNewNama(e.target.value)}
                    placeholder="Nama lengkap pengurus"
                    className="w-full mt-1 border border-stone-200 focus:border-orange-600 outline-none rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-stone-700 uppercase">Departemen</label>
                    <select
                      value={newDivisi}
                      onChange={(e) => setNewDivisi(e.target.value)}
                      className="w-full mt-1 border border-stone-200 focus:border-orange-600 outline-none rounded-xl px-3 py-2.5 text-xs font-semibold bg-white"
                    >
                      {DEPARTEMEN_HMIF.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 uppercase">Hari Piket</label>
                    <select
                      value={newHari}
                      onChange={(e) => setNewHari(e.target.value)}
                      className="w-full mt-1 border border-stone-200 focus:border-orange-600 outline-none rounded-xl px-3 py-2.5 text-xs font-semibold bg-white"
                    >
                      {HARI_ORDER.map((hari) => (
                        <option key={hari} value={hari}>
                          {hari}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-stone-700 uppercase">Password Awal</label>
                    <input
                      type="text"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full mt-1 border border-stone-200 focus:border-orange-600 outline-none rounded-xl px-3.5 py-2.5 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 uppercase">Hak Akses</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as "pengurus" | "admin")}
                      className="w-full mt-1 border border-stone-200 focus:border-orange-600 outline-none rounded-xl px-3 py-2.5 text-xs font-semibold bg-white"
                    >
                      <option value="pengurus">Pengurus Biasa</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-2.5 rounded-xl text-xs transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={addingUser}
                  className="flex-1 bg-orange-700 hover:bg-orange-800 disabled:bg-stone-300 text-white font-bold py-2.5 rounded-xl text-xs transition"
                >
                  {addingUser ? "Menyimpan..." : "Simpan Anggota"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal Preview Bukti Foto */}
        {previewModal && (
          <div className="fixed inset-0 bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700">
                    Dokumentasi {previewModal.status === "izin" ? "Izin" : "Piket Sekre"}
                  </span>
                  <h3 className="font-extrabold text-lg text-stone-900">{previewModal.nama}</h3>
                </div>
                <button
                  onClick={() => setPreviewModal(null)}
                  className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 font-bold"
                >
                  ✕
                </button>
              </div>
              <img
                src={previewModal.fotoSekre || previewModal.fotoBuktiIzin}
                alt="Bukti"
                className="w-full rounded-2xl border border-stone-200 max-h-80 object-contain bg-stone-50"
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