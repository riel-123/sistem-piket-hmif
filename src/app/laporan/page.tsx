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
  Pencil,
  Trash2,
  PlusCircle,
  UserCog,
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

  // 4. State CRUD ANGGOTA (Daftar, Tambah, Edit, Hapus)
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [showMembersDrawer, setShowMembersDrawer] = useState(false);
  const [searchMemberQuery, setSearchMemberQuery] = useState("");
  const [showUserFormModal, setShowUserFormModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [formNim, setFormNim] = useState("");
  const [formNama, setFormNama] = useState("");
  const [formDivisi, setFormDivisi] = useState(DEPARTEMEN_HMIF[0]);
  const [formPassword, setFormPassword] = useState("hmif2026");
  const [formRole, setFormRole] = useState<"pengurus" | "admin">("pengurus");
  const [formHari, setFormHari] = useState("Senin");
  const [savingUser, setSavingUser] = useState(false);
  const [userFormErr, setUserFormErr] = useState("");

  // 5. State CRUD REKAP KEHADIRAN (Tambah/Edit Presensi Manual)
  const [showPresensiModal, setShowPresensiModal] = useState(false);
  const [presUserId, setPresUserId] = useState<string>("");
  const [presTanggal, setPresTanggal] = useState<string>("");
  const [presStatus, setPresStatus] = useState<"hadir" | "izin" | "alfa">("hadir");
  const [presWaktu, setPresWaktu] = useState<string>("08:00");
  const [presJenisIzin, setPresJenisIzin] = useState<string>("Sakit");
  const [presAlasanIzin, setPresAlasanIzin] = useState<string>("");
  const [savingPresensi, setSavingPresensi] = useState(false);
  const [presensiErr, setPresensiErr] = useState("");

  const [previewModal, setPreviewModal] = useState<any | null>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // State Acak & Edit Jadwal
  const [canShuffle, setCanShuffle] = useState(false);
  const [jadwalList, setJadwalList] = useState<any[]>([]);
  const [jadwalTab, setJadwalTab] = useState<"hari" | "departemen">("hari");
  const [shuffling, setShuffling] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [shuffleMsg, setShuffleMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadAllMembers = () => {
    fetch("/api/user")
      .then((res) => res.json())
      .then((data) => {
        setAllMembers(data.users || []);
      });
  };

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
    setPresTanggal(todayFormatted);
    loadAllMembers();
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

  // =========================================================================
  // HANDLER CRUD ANGGOTA (CREATE, UPDATE, DELETE)
  // =========================================================================
  const openCreateUserModal = () => {
    setEditingUser(null);
    setFormNim("");
    setFormNama("");
    setFormDivisi(DEPARTEMEN_HMIF[0]);
    setFormPassword("hmif2026");
    setFormRole("pengurus");
    setFormHari("Senin");
    setUserFormErr("");
    setShowUserFormModal(true);
  };

  const openEditUserModal = (member: any) => {
    setEditingUser(member);
    setFormNim(member.nim);
    setFormNama(member.nama);
    setFormDivisi(member.divisi);
    setFormPassword(member.password || "");
    setFormRole(String(member.role).toLowerCase() === "admin" ? "admin" : "pengurus");
    setFormHari(member.hari && member.hari !== "-" ? member.hari : "Senin");
    setUserFormErr("");
    setShowUserFormModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUser) return;
    setUserFormErr("");
    setSavingUser(true);

    const isEdit = Boolean(editingUser);
    const res = await fetch("/api/user", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminId: adminUser.id,
        ...(isEdit ? { userId: editingUser.id } : {}),
        nim: formNim,
        nama: formNama,
        divisi: formDivisi,
        password: formPassword,
        role: formRole,
        hari: formHari,
      }),
    });

    const data = await res.json();
    setSavingUser(false);

    if (!res.ok) {
      setUserFormErr(data.error);
    } else {
      setShuffleMsg({ type: "ok", text: data.message });
      setShowUserFormModal(false);
      loadAllMembers();
      loadJadwalStatus();
      fetchDetailLogHarian();
      fetchRekapKehadiran();
    }
  };

  const handleDeleteUser = async (member: any) => {
    if (!adminUser) return;
    const ok = window.confirm(
      `Yakin ingin menghapus anggota "${member.nama}" (${member.nim})? Seluruh riwayat presensi dan tukar jadwalnya juga akan terhapus.`
    );
    if (!ok) return;

    const res = await fetch(`/api/user?adminId=${adminUser.id}&userId=${member.id}`, {
      method: "DELETE",
    });
    const data = await res.json();

    if (!res.ok) {
      setShuffleMsg({ type: "err", text: data.error });
    } else {
      setShuffleMsg({ type: "ok", text: data.message });
      loadAllMembers();
      loadJadwalStatus();
      fetchDetailLogHarian();
      fetchRekapKehadiran();
    }
  };

  // =========================================================================
  // HANDLER CRUD REKAP KEHADIRAN (CREATE/UPDATE & DELETE)
  // =========================================================================
  const openPresensiModal = (prefill?: {
    userId?: number;
    tanggal?: string;
    status?: string;
    waktuLapor?: string;
    jenisIzin?: string;
    alasanIzin?: string;
  }) => {
    setPresensiErr("");
    setPresUserId(prefill?.userId ? String(prefill.userId) : allMembers[0]?.id ? String(allMembers[0].id) : "");
    setPresTanggal(prefill?.tanggal || logDate || getTodayWibFormatted());
    setPresStatus(
      prefill?.status === "izin" || prefill?.status === "alfa" || prefill?.status === "hadir"
        ? prefill.status
        : "hadir"
    );
    setPresWaktu(prefill?.waktuLapor && prefill.waktuLapor !== "-" ? prefill.waktuLapor : "08:00");
    setPresJenisIzin(prefill?.jenisIzin || "Sakit");
    setPresAlasanIzin(prefill?.alasanIzin || "");
    setShowPresensiModal(true);
  };

  const handleSavePresensi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUser) return;
    setPresensiErr("");
    setSavingPresensi(true);

    const res = await fetch("/api/laporan/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminId: adminUser.id,
        userId: Number(presUserId),
        tanggal: presTanggal,
        status: presStatus,
        waktuLapor: presWaktu,
        jenisIzin: presJenisIzin,
        alasanIzin: presAlasanIzin,
      }),
    });

    const data = await res.json();
    setSavingPresensi(false);

    if (!res.ok) {
      setPresensiErr(data.error);
    } else {
      setShuffleMsg({ type: "ok", text: data.message });
      setShowPresensiModal(false);
      fetchDetailLogHarian();
      fetchRekapKehadiran();
    }
  };

  const handleDeletePresensi = async (log: any) => {
    if (!adminUser) return;
    const ok = window.confirm(
      `Reset/hapus catatan presensi milik "${log.nama}" pada tanggal ${log.tanggal}?`
    );
    if (!ok) return;

    const res = await fetch(
      `/api/laporan/manage?adminId=${adminUser.id}&userId=${log.userId}&tanggal=${log.tanggal}`,
      { method: "DELETE" }
    );
    const data = await res.json();

    if (!res.ok) {
      setShuffleMsg({ type: "err", text: data.error });
    } else {
      setShuffleMsg({ type: "ok", text: data.message });
      fetchDetailLogHarian();
      fetchRekapKehadiran();
    }
  };

  // =========================================================================
  // HANDLER ACAK & UBAH JADWAL MINGGUAN
  // =========================================================================
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
      loadAllMembers();
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
      loadAllMembers();
      fetchDetailLogHarian();
      fetchRekapKehadiran();
    }
  };

  // SHARE WHATSAPP & COPY EXCEL
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
      return [idx + 1, u.nim, u.nama, u.divisi, u.hadir, u.izin, u.alfa, rincian || "-"].join("\t");
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

  const filteredMembers = allMembers.filter((m) => {
    const q = searchMemberQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      m.nama.toLowerCase().includes(q) ||
      String(m.nim).toLowerCase().includes(q) ||
      m.divisi.toLowerCase().includes(q) ||
      m.hari.toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q)
    );
  });

  const daftarDepartemenTampil = Array.from(
    new Set([...DEPARTEMEN_HMIF, ...jadwalList.map((u) => u.divisi)])
  );

  return (
    <div className="min-h-screen bg-stone-100/90 text-stone-900 pb-12">
      {/* Header Banner — Nuansa Oranye Kalem */}
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
              Operasional Senin – Jumat (07.00 – 17.00 WIB) • Kelola data anggota & rekap kehadiran
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowMembersDrawer((prev) => !prev)}
              className="bg-amber-100 hover:bg-amber-200 text-orange-950 px-3.5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md transition"
            >
              <UserCog className="w-4 h-4 text-orange-800" />
              {showMembersDrawer ? "Tutup Data Anggota" : `Kelola Anggota (${allMembers.length})`}
            </button>

            <button
              type="button"
              onClick={openCreateUserModal}
              className="bg-white text-orange-900 hover:bg-orange-50 px-3.5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md transition"
            >
              <UserPlus className="w-4 h-4 text-orange-700" /> + Tambah Anggota
            </button>

            <button
              onClick={copyRekapKehadiranExcel}
              className="bg-emerald-700 hover:bg-emerald-600 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition"
            >
              {copiedType === "rekap_excel" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedType === "rekap_excel" ? "Tersalin!" : "Copy Rekap (Excel)"}
            </button>

            <button
              onClick={exportExcelPerHari}
              className="bg-orange-950/60 hover:bg-orange-950/80 text-orange-50 border border-orange-300/25 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition"
            >
              <Download className="w-4 h-4" /> .XLSX (Hari)
            </button>

            <button
              onClick={exportExcelPerDepartemen}
              className="bg-orange-950/60 hover:bg-orange-950/80 text-orange-50 border border-orange-300/25 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition"
            >
              <Download className="w-4 h-4" /> .XLSX (Dept)
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-4 space-y-6">
        {shuffleMsg && (
          <div
            className={`p-3.5 rounded-2xl text-xs sm:text-sm font-semibold border shadow-sm ${
              shuffleMsg.type === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-700"
            }`}
          >
            {shuffleMsg.text}
          </div>
        )}

        {/* ============================================================== */}
        {/* PANEL CRUD DATA ANGGOTA (CREATE, READ, UPDATE, DELETE)         */}
        {/* ============================================================== */}
        {showMembersDrawer && (
          <div className="bg-white rounded-2xl border border-orange-200 shadow-md overflow-hidden">
            <div className="p-4 sm:p-5 bg-orange-50/70 border-b border-orange-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-extrabold text-stone-900 text-base">
                  Database Anggota & Pengurus ({filteredMembers.length} Orang)
                </h2>
                <p className="text-xs text-stone-500">
                  Tambah, ubah NIM/nama/departemen/password/role, atau hapus anggota pengurus
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchMemberQuery}
                    onChange={(e) => setSearchMemberQuery(e.target.value)}
                    placeholder="Cari NIM, nama, dept..."
                    className="w-full sm:w-56 border border-stone-200 focus:border-orange-700 outline-none rounded-xl pl-9 pr-3 py-2 text-xs font-medium bg-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={openCreateUserModal}
                  className="bg-orange-800 hover:bg-orange-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Tambah Baru
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm text-left">
                <thead className="bg-stone-50 text-stone-500 text-xs uppercase sticky top-0">
                  <tr>
                    <th className="p-3.5">NIM</th>
                    <th className="p-3.5">Nama Lengkap</th>
                    <th className="p-3.5">Departemen</th>
                    <th className="p-3.5">Hari Piket</th>
                    <th className="p-3.5">Password</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-orange-50/30 transition">
                      <td className="p-3.5 font-mono text-xs text-stone-700">{m.nim}</td>
                      <td className="p-3.5 font-bold text-stone-900">{m.nama}</td>
                      <td className="p-3.5 text-xs font-semibold text-orange-800">{m.divisi}</td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 font-bold text-xs">
                          {m.hari}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-xs text-stone-500">{m.password}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            String(m.role).toLowerCase() === "admin"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {m.role}
                        </span>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditUserModal(m)}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(m)}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition"
                          >
                            <Trash2 className="w-3 h-3" /> Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
        {/* DETAIL LOG KEHADIRAN HARIAN + CRUD PRESENSI                    */}
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
                  Admin dapat menambah, mengubah status, atau menghapus log kehadiran anggota
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={() => openPresensiModal({ tanggal: logDate })}
                  className="bg-orange-800 hover:bg-orange-900 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shrink-0"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> + Input Kehadiran
                </button>

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
                  {copiedType === "log_excel" ? "Tersalin!" : "Copy Log"}
                </button>

                <div className="relative">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchLog}
                    onChange={(e) => setSearchLog(e.target.value)}
                    placeholder="Cari nama, NIM, status..."
                    className="w-full sm:w-44 border border-stone-200 focus:border-orange-600 outline-none rounded-xl pl-9 pr-3 py-2 text-xs font-medium bg-stone-50"
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
                Tidak ada log piket pada tanggal ini. Gunakan tombol <strong>+ Input Kehadiran</strong> jika ingin mencatat presensi manual.
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
                      <th className="p-3.5">Dokumentasi</th>
                      <th className="p-3.5 text-right">Kelola</th>
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
                          ) : (
                            <span className="text-stone-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openPresensiModal(log)}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePresensi(log)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition"
                            >
                              <Trash2 className="w-3 h-3" /> Reset
                            </button>
                          </div>
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
        {/* REKAP KEHADIRAN PER PENGURUS (MINGGUAN / BULANAN)              */}
        {/* ============================================================== */}
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="font-extrabold text-stone-800 text-sm sm:text-base">
                Rekap Kehadiran Per Pengurus ({rekapMode === "mingguan" ? "Mingguan" : "Bulanan"})
              </h2>
              <p className="text-xs text-stone-400">
                Klik badge hari piket pada baris anggota untuk langsung mengedit status kehadirannya
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
                Copy Rekap (Excel)
              </button>

              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchRekap}
                  onChange={(e) => setSearchRekap(e.target.value)}
                  placeholder="Cari nama, NIM, dept..."
                  className="w-full sm:w-44 border border-stone-200 focus:border-orange-600 outline-none rounded-xl pl-9 pr-3 py-2 text-xs font-medium bg-stone-50"
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
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredRekapUser.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-stone-400">
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
                              <button
                                key={i}
                                type="button"
                                onClick={() =>
                                  openPresensiModal({
                                    userId: u.userId,
                                    tanggal: r.tanggal,
                                    status: r.status,
                                  })
                                }
                                title="Klik untuk edit status hari ini"
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition hover:opacity-80 ${
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
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-stone-400">Belum ada jadwal/catatan</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openPresensiModal({ userId: u.userId })}
                          className="bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition"
                        >
                          <PlusCircle className="w-3 h-3" /> Input
                        </button>
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
        {/* MODAL TAMBAH / EDIT ANGGOTA                                    */}
        {/* ============================================================== */}
        {showUserFormModal && (
          <div className="fixed inset-0 bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <form
              onSubmit={handleSaveUser}
              className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700">
                    Manajemen Pengurus HMIF
                  </span>
                  <h3 className="font-extrabold text-lg text-stone-900">
                    {editingUser ? "Edit Data Anggota" : "Tambah Anggota Baru"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUserFormModal(false)}
                  className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 font-bold"
                >
                  ✕
                </button>
              </div>

              {userFormErr && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl font-semibold">
                  {userFormErr}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 uppercase">NIM</label>
                  <input
                    type="text"
                    required
                    value={formNim}
                    onChange={(e) => setFormNim(e.target.value)}
                    placeholder="Contoh: 2350081099"
                    className="w-full mt-1 border border-stone-200 focus:border-orange-600 outline-none rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 uppercase">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={formNama}
                    onChange={(e) => setFormNama(e.target.value)}
                    placeholder="Nama lengkap pengurus"
                    className="w-full mt-1 border border-stone-200 focus:border-orange-600 outline-none rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-stone-700 uppercase">Departemen</label>
                    <select
                      value={formDivisi}
                      onChange={(e) => setFormDivisi(e.target.value)}
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
                      value={formHari}
                      onChange={(e) => setFormHari(e.target.value)}
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
                    <label className="text-xs font-bold text-stone-700 uppercase">Password</label>
                    <input
                      type="text"
                      required={!editingUser}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full mt-1 border border-stone-200 focus:border-orange-600 outline-none rounded-xl px-3.5 py-2.5 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 uppercase">Hak Akses</label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value as "pengurus" | "admin")}
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
                  onClick={() => setShowUserFormModal(false)}
                  className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-2.5 rounded-xl text-xs transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="flex-1 bg-orange-800 hover:bg-orange-900 disabled:bg-stone-300 text-white font-bold py-2.5 rounded-xl text-xs transition"
                >
                  {savingUser ? "Menyimpan..." : editingUser ? "Simpan Perubahan" : "Simpan Anggota"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL INPUT / EDIT KEHADIRAN MANUAL (CRUD REKAP)               */}
        {/* ============================================================== */}
        {showPresensiModal && (
          <div className="fixed inset-0 bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <form
              onSubmit={handleSavePresensi}
              className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700">
                    Kelola Rekap Kehadiran
                  </span>
                  <h3 className="font-extrabold text-lg text-stone-900">
                    Input / Edit Status Piket
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPresensiModal(false)}
                  className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 font-bold"
                >
                  ✕
                </button>
              </div>

              {presensiErr && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl font-semibold">
                  {presensiErr}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 uppercase">Pengurus</label>
                  <select
                    required
                    value={presUserId}
                    onChange={(e) => setPresUserId(e.target.value)}
                    className="w-full mt-1 border border-stone-200 focus:border-orange-600 outline-none rounded-xl px-3 py-2.5 text-xs font-semibold bg-white"
                  >
                    <option value="">-- Pilih Pengurus --</option>
                    {allMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nama} ({m.nim} • {m.divisi})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-stone-700 uppercase">Tanggal</label>
                    <input
                      type="date"
                      required
                      value={presTanggal}
                      onChange={(e) => setPresTanggal(e.target.value)}
                      className="w-full mt-1 border border-stone-200 focus:border-orange-600 outline-none rounded-xl px-3 py-2 text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 uppercase">Status</label>
                    <select
                      value={presStatus}
                      onChange={(e) =>
                        setPresStatus(e.target.value as "hadir" | "izin" | "alfa")
                      }
                      className="w-full mt-1 border border-stone-200 focus:border-orange-600 outline-none rounded-xl px-3 py-2 text-xs font-bold bg-white"
                    >
                      <option value="hadir">HADIR</option>
                      <option value="izin">IZIN</option>
                      <option value="alfa">ALFA</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 uppercase">
                    Jam Lapor (WIB)
                  </label>
                  <input
                    type="text"
                    value={presWaktu}
                    onChange={(e) => setPresWaktu(e.target.value)}
                    placeholder="Contoh: 08:30"
                    className="w-full mt-1 border border-stone-200 focus:border-orange-600 outline-none rounded-xl px-3.5 py-2 text-xs font-mono"
                  />
                </div>

                {presStatus === "izin" && (
                  <>
                    <div>
                      <label className="text-xs font-bold text-stone-700 uppercase">
                        Kategori Izin
                      </label>
                      <input
                        type="text"
                        value={presJenisIzin}
                        onChange={(e) => setPresJenisIzin(e.target.value)}
                        placeholder="Sakit / Akademik / Lainnya"
                        className="w-full mt-1 border border-stone-200 focus:border-orange-600 outline-none rounded-xl px-3.5 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-stone-700 uppercase">
                        Alasan Izin
                      </label>
                      <input
                        type="text"
                        value={presAlasanIzin}
                        onChange={(e) => setPresAlasanIzin(e.target.value)}
                        placeholder="Keterangan izin..."
                        className="w-full mt-1 border border-stone-200 focus:border-orange-600 outline-none rounded-xl px-3.5 py-2 text-xs"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPresensiModal(false)}
                  className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-2.5 rounded-xl text-xs transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingPresensi}
                  className="flex-1 bg-orange-800 hover:bg-orange-900 disabled:bg-stone-300 text-white font-bold py-2.5 rounded-xl text-xs transition"
                >
                  {savingPresensi ? "Menyimpan..." : "Simpan Kehadiran"}
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