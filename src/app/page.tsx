"use client";

import React, { useState, useEffect } from "react";
import CameraWatermark from "@/components/CameraWatermark";
import {
  CheckSquare,
  FileText,
  LogOut,
  ClipboardList,
  Send,
  Lock,
  Sparkles,
  CalendarDays,
  Clock,
  ShieldCheck,
  CheckCircle2,
  UserCheck,
  AlertCircle,
  ArrowLeftRight,
  Users,
  Building2,
  Check,
  X,
  TrendingUp,
  Search,
} from "lucide-react";
import Link from "next/link";

const TUGAS_PIKET = [
  "Menyapu & mengepel lantai sekre",
  "Merapikan meja, kursi, dan barang organisasi",
  "Membuang sampah ke tempat pembuangan",
  "Mematikan AC, lampu, & mengunci sekre (jika terakhir)",
];

const HARI_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const HARI_KERJA = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
const URUTAN_HARI: Record<string, number> = {
  Senin: 1,
  Selasa: 2,
  Rabu: 3,
  Kamis: 4,
  Jumat: 5,
};

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

function cekHariSudahLewat(hariTarget: string): boolean {
  if (!URUTAN_HARI[hariTarget]) return true;
  const nowWib = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const dayOfWeek = nowWib.getDay(); // 0=Minggu, 1=Senin..5=Jumat, 6=Sabtu
  const jam = nowWib.getHours();

  // Sabtu/Minggu: semua hari Senin-Jumat minggu depan valid untuk ditukar
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  const targetIdx = URUTAN_HARI[hariTarget];
  if (targetIdx < dayOfWeek) return true;
  if (targetIdx === dayOfWeek && jam >= 17) return true;
  return false;
}

export default function HomePage() {
  const [user, setUser] = useState<any | null>(null);
  const [hariIni, setHariIni] = useState<string>("");
  const [jamSekarang, setJamSekarang] = useState<string>("");
  const [isJamOperasional, setIsJamOperasional] = useState<boolean>(true);
  const [timeReady, setTimeReady] = useState<boolean>(false);

  // Statistik Persentase Kehadiran Pribadi
  const [stats, setStats] = useState<{
    hadir: number;
    izin: number;
    alfa: number;
    totalSelesai: number;
    persentase: number;
  }>({ hadir: 0, izin: 0, alfa: 0, totalSelesai: 0, persentase: 100 });

  // Mode navigasi utama: "absen" atau "jadwal"
  const [mainSection, setMainSection] = useState<"absen" | "jadwal">("absen");
  const [jadwalViewMode, setJadwalViewMode] = useState<"hari" | "departemen">("hari");

  // Pencarian pada Tukar Jadwal (Form Pengajuan, Permintaan Masuk, & Direktori)
  const [searchTukarTarget, setSearchTukarTarget] = useState<string>("");
  const [searchPermintaanTukar, setSearchPermintaanTukar] = useState<string>("");
  const [searchDirektori, setSearchDirektori] = useState<string>("");

  // Data seluruh jadwal & tukar jadwal
  const [allSchedules, setAllSchedules] = useState<any[]>([]);
  const [tukarMasuk, setTukarMasuk] = useState<any[]>([]);
  const [tukarKeluar, setTukarKeluar] = useState<any[]>([]);
  const [tujuanId, setTujuanId] = useState<string>("");
  const [alasanTukar, setAlasanTukar] = useState<string>("");
  const [tukarLoading, setTukarLoading] = useState(false);
  const [tukarFeedback, setTukarFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const [nim, setNim] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<"hadir" | "izin">("hadir");
  const [checklist, setChecklist] = useState<string[]>([]);
  const [fotoSekre, setFotoSekre] = useState<File | null>(null);

  const [jenisIzin, setJenisIzin] = useState("Sakit");
  const [alasanIzin, setAlasanIzin] = useState("");
  const [fotoIzin, setFotoIzin] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const refreshUserAndSchedules = (userId: number) => {
    fetch(`/api/user/${userId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((freshUser) => {
        if (freshUser) {
          setUser(freshUser);
          localStorage.setItem("piket_user", JSON.stringify(freshUser));
        }
      })
      .catch(() => {});

    fetch(`/api/user/${userId}/stats`)
      .then((res) => (res.ok ? res.json() : null))
      .then((statData) => {
        if (statData && typeof statData.persentase === "number") {
          setStats(statData);
        }
      })
      .catch(() => {});

    fetch("/api/jadwal/acak")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.users) setAllSchedules(data.users);
      })
      .catch(() => {});

    fetch(`/api/tukar?userId=${userId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setTukarMasuk(data.masuk || []);
          setTukarKeluar(data.keluar || []);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    const saved = localStorage.getItem("piket_user");
    if (saved) {
      const parsed = JSON.parse(saved);
      setUser(parsed);
      refreshUserAndSchedules(parsed.id);
    }

    const updateTime = () => {
      const now = new Date();
      const wibString = now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
      const wibDate = new Date(wibString);
      const jamAngka = wibDate.getHours();

      setHariIni(HARI_ID[wibDate.getDay()]);
      setJamSekarang(
        now.toLocaleTimeString("id-ID", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      setIsJamOperasional(jamAngka >= 7 && jamAngka < 17);
      setTimeReady(true);
    };

    updateTime();
    const timer = setInterval(updateTime, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nim, password }),
    });
    const data = await res.json();
    setLoginLoading(false);
    if (!res.ok) return setLoginError(data.error);

    localStorage.setItem("piket_user", JSON.stringify(data));
    setUser(data);
    refreshUserAndSchedules(data.id);
  };

  const handleLogout = () => {
    localStorage.removeItem("piket_user");
    setUser(null);
  };

  const toggleTugas = (item: string) => {
    setChecklist((prev) =>
      prev.includes(item) ? prev.filter((t) => t !== item) : [...prev, item]
    );
  };

  const handleSearchTukarChange = (val: string) => {
    setSearchTukarTarget(val);
    if (!user) return;
    const q = val.trim().toLowerCase();
    const matches = allSchedules.filter((u) => {
      if (u.id === user.id || u.hari === "-" || u.hari === user.jadwal?.[0]) return false;
      if (cekHariSudahLewat(u.hari)) return false;
      if (!q) return true;
      return (
        u.nama.toLowerCase().includes(q) ||
        String(u.nim).toLowerCase().includes(q) ||
        u.divisi.toLowerCase().includes(q) ||
        u.hari.toLowerCase().includes(q)
      );
    });

    const exactNim = matches.find((u) => String(u.nim).toLowerCase() === q);
    if (exactNim) {
      setTujuanId(String(exactNim.id));
    } else if (q && matches.length === 1) {
      setTujuanId(String(matches[0].id));
    } else if (!matches.some((u) => String(u.id) === tujuanId)) {
      setTujuanId("");
    }
  };

  const handleAjukanTukar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setTukarFeedback(null);
    setTukarLoading(true);

    const res = await fetch("/api/tukar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pemohonId: user.id,
        tujuanId: Number(tujuanId),
        alasan: alasanTukar,
      }),
    });
    const data = await res.json();
    setTukarLoading(false);

    if (!res.ok) {
      setTukarFeedback({ type: "err", text: data.error });
    } else {
      setTukarFeedback({ type: "ok", text: data.message });
      setTujuanId("");
      setSearchTukarTarget("");
      setAlasanTukar("");
      refreshUserAndSchedules(user.id);
    }
  };

  const handleKonfirmasiTukar = async (requestId: number, aksi: "setuju" | "tolak") => {
    if (!user) return;
    setTukarFeedback(null);

    const res = await fetch("/api/tukar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId,
        userId: user.id,
        aksi,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setTukarFeedback({ type: "err", text: data.error });
    } else {
      setTukarFeedback({ type: "ok", text: data.message });
      refreshUserAndSchedules(user.id);
    }
  };

  const isJadwalHariIni = hariIni ? Boolean(user?.jadwal?.includes(hariIni)) : false;
  const bisaIsiAbsen = isJamOperasional && isJadwalHariIni;
  const progressPersen = Math.round((checklist.length / TUGAS_PIKET.length) * 100);
  const pendingMasukCount = tukarMasuk.filter((t) => t.status === "pending").length;
  const isAdmin = String(user?.role || "").toLowerCase() === "admin";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bisaIsiAbsen) return;

    setMessage(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("userId", String(user.id));
    formData.append("tipe", activeTab);

    if (activeTab === "hadir") {
      if (!fotoSekre) {
        setLoading(false);
        return setMessage({ type: "err", text: "Silakan ambil foto bukti sekre terlebih dahulu." });
      }
      formData.append("foto", fotoSekre);
      formData.append("checklist", JSON.stringify(checklist));
    } else {
      if (!fotoIzin || alasanIzin.trim().length < 5) {
        setLoading(false);
        return setMessage({ type: "err", text: "Alasan izin dan foto bukti wajib diisi." });
      }
      formData.append("foto", fotoIzin);
      formData.append("jenisIzin", jenisIzin);
      formData.append("alasanIzin", alasanIzin);
    }

    const res = await fetch("/api/presensi", { method: "POST", body: formData });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage({ type: "err", text: data.error });
    } else {
      setMessage({ type: "ok", text: data.message });
      refreshUserAndSchedules(user.id);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-4xl grid lg:grid-cols-2 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/20 z-10">
          <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-700 p-10 text-white">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold tracking-wide">
                <Sparkles className="w-3.5 h-3.5" /> HMIF SEKRETARIAT
              </span>
              <h2 className="text-3xl font-extrabold mt-6 leading-tight">
                Sistem Monitoring & Absensi Piket Harian
              </h2>
              <p className="text-indigo-100 text-sm mt-3 leading-relaxed">
                Jaga kenyamanan ruang sekretariat bersama. Lapor bukti kebersihan dengan watermark otomatis, cek jadwal departemen, atau tukar jadwal dengan rekan.
              </p>
            </div>

            <div className="space-y-3 bg-white/10 p-4 rounded-2xl border border-white/15 text-xs">
              <div className="flex items-center gap-2.5">
                <CalendarDays className="w-4 h-4 text-indigo-200 shrink-0" />
                <span>Jadwal Operasional: <strong>Senin – Jumat</strong></span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-indigo-200 shrink-0" />
                <span>Jam Lapor & Izin: <strong>07.00 – 17.00 WIB</strong></span>
              </div>
            </div>
          </div>

          <form onSubmit={handleLogin} className="p-7 sm:p-10 flex flex-col justify-center space-y-5">
            <div>
              <div className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-bold mb-3">
                <Sparkles className="w-3 h-3" /> PIKET SEKRE HMIF
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900">Selamat Datang</h1>
              <p className="text-sm text-slate-500 mt-1">Masuk dengan NIM dan password pengurus</p>
            </div>

            {loginError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs p-3.5 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">NIM Pengurus</label>
                <input
                  type="text"
                  required
                  value={nim}
                  onChange={(e) => setNim(e.target.value)}
                  placeholder="Contoh: 2350081019"
                  className="w-full mt-1.5 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none rounded-xl px-4 py-3 text-sm text-slate-900 transition"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full mt-1.5 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none rounded-xl px-4 py-3 text-sm text-slate-900 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg shadow-indigo-500/25 transition active:scale-[0.99]"
            >
              {loginLoading ? "Memeriksa Akun..." : "Masuk ke Sistem"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // PENGUNCI PENUH UNTUK PENGGUNA BIASA DI LUAR JAM 07.00 - 17.00 WIB
  if (timeReady && !isJamOperasional && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 text-slate-900">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center shadow-2xl space-y-5 border border-white/20">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-rose-500/25">
            <Clock className="w-8 h-8" />
          </div>
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-bold uppercase tracking-wider mb-2">
              Di Luar Jam Operasional
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Sistem Piket Sedang Tutup
            </h1>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Halo <strong>{user.nama}</strong>, akses sistem absensi piket hanya dibuka pada pukul{" "}
              <strong className="text-slate-800">07.00 – 17.00 WIB</strong>. Sekarang pukul{" "}
              <strong className="text-indigo-600">{jamSekarang} WIB</strong>.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleLogout}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition"
            >
              <LogOut className="w-4 h-4" /> Keluar Akun
            </button>
          </div>
        </div>
      </div>
    );
  }

  const alasanTerkunci = !isJamOperasional
    ? {
        judul: "Jam absensi sudah ditutup (07.00 – 17.00 WIB)",
        deskripsi: `Sekarang pukul ${jamSekarang} WIB. Form absensi terkunci di luar jam operasional, namun Anda tetap dapat mengakses menu Rekap & Panel Admin di atas.`,
      }
    : {
        judul: "Hari ini kamu tidak piket, jadi tidak bisa diakses ya!!",
        deskripsi: `Form pelaporan dan pengajuan izin otomatis dikunci di luar jadwal piketmu (${
          user.jadwal?.join(", ") || "Belum diatur"
        }).`,
      };

  const hariPiketSaya = user.jadwal?.[0] || "";
  const jadwalSayaSudahLewat = hariPiketSaya ? cekHariSudahLewat(hariPiketSaya) : false;

  // Filter kandidat rekan untuk form tukar jadwal:
  // Tidak boleh diri sendiri, tidak boleh hari yang sama, dan TIDAK BOLEH HARI SEBELUMNYA / SUDAH LEWAT
  const kandidatTukarFiltered = allSchedules.filter((u) => {
    if (u.id === user.id || u.hari === "-" || u.hari === hariPiketSaya) return false;
    if (cekHariSudahLewat(u.hari)) return false;

    const q = searchTukarTarget.trim().toLowerCase();
    if (!q) return true;
    return (
      u.nama.toLowerCase().includes(q) ||
      String(u.nim).toLowerCase().includes(q) ||
      u.divisi.toLowerCase().includes(q) ||
      u.hari.toLowerCase().includes(q)
    );
  });

  // Filter Permintaan Tukar Masuk berdasarkan Nama, NIM, Departemen, atau Hari
  const filteredTukarMasuk = tukarMasuk.filter((item) => {
    const q = searchPermintaanTukar.trim().toLowerCase();
    if (!q) return true;
    return (
      item.pemohon.nama.toLowerCase().includes(q) ||
      String(item.pemohon.nim).toLowerCase().includes(q) ||
      item.pemohon.divisi.toLowerCase().includes(q) ||
      item.hariPemohon.toLowerCase().includes(q) ||
      item.hariTujuan.toLowerCase().includes(q)
    );
  });

  // Filter direktori seluruh pengurus berdasarkan Nama, NIM, Departemen, atau Hari
  const filteredDirektoriSchedules = allSchedules.filter((u) => {
    const q = searchDirektori.trim().toLowerCase();
    if (!q) return true;
    return (
      u.nama.toLowerCase().includes(q) ||
      String(u.nim).toLowerCase().includes(q) ||
      u.divisi.toLowerCase().includes(q) ||
      u.hari.toLowerCase().includes(q)
    );
  });

  const daftarDepartemenTampil = Array.from(
    new Set([...DEPARTEMEN_HMIF, ...allSchedules.map((u) => u.divisi)])
  );

  return (
    <div className="min-h-screen bg-slate-100/80 pb-14 text-slate-900">
      {/* Top Navbar Glassmorphism */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-extrabold shadow-sm">
              P
            </div>
            <div>
              <span className="font-extrabold text-slate-900 text-sm sm:text-base block leading-none">
                Piket Sekre HMIF
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {hariIni ? `${hariIni} • ${jamSekarang} WIB` : "Memuat waktu..."}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {isAdmin && (
              <Link
                href="/laporan"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <ClipboardList className="w-4 h-4" />
                <span>Rekap & Panel Admin</span>
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 p-2.5 rounded-xl transition"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        {/* MENU NAVIGASI UTAMA: ABSENSI PIKET vs JADWAL & TUKAR */}
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-sm grid grid-cols-2 max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => setMainSection("absen")}
            className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition ${
              mainSection === "absen"
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Absensi Piket</span>
          </button>

          <button
            type="button"
            onClick={() => setMainSection("jadwal")}
            className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition relative ${
              mainSection === "jadwal"
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Jadwal & Tukar</span>
            {pendingMasukCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-black rounded-full bg-rose-500 text-white animate-pulse">
                {pendingMasukCount}
              </span>
            )}
          </button>
        </div>

        {/* ============================================================== */}
        {/* BAGIAN 1: ABSENSI PIKET                                        */}
        {/* ============================================================== */}
        {mainSection === "absen" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* KOLOM KIRI: Kartu Profil, Persentase Kehadiran, & Jadwal */}
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-500/15 relative overflow-hidden">
                <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-bold uppercase tracking-wider">
                      <ShieldCheck className="w-3.5 h-3.5" /> {user.divisi}
                    </span>
                    <h1 className="text-xl sm:text-2xl font-extrabold mt-3 leading-snug">{user.nama}</h1>
                    <p className="text-indigo-200 text-xs font-mono mt-0.5">NIM: {user.nim}</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-lg font-black shrink-0 border border-white/20">
                    {user.nama?.charAt(0)}
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-white/15">
                  <p className="text-xs text-indigo-100 font-semibold mb-2.5">Jadwal Piket Minggu Ini:</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {HARI_KERJA.map((hari) => {
                      const isMyDay = user.jadwal?.includes(hari);
                      const isToday = hariIni === hari;
                      return (
                        <div
                          key={hari}
                          className={`py-2 px-1 rounded-xl text-center border transition ${
                            isMyDay
                              ? "bg-white text-indigo-700 border-white font-extrabold shadow-sm"
                              : "bg-white/10 text-indigo-200 border-white/10 font-medium"
                          } ${isToday ? "ring-2 ring-amber-300" : ""}`}
                        >
                          <span className="text-[11px] block">{hari.slice(0, 3)}</span>
                          <span className="text-[9px] block mt-0.5 opacity-80">
                            {isMyDay ? "PIKET" : "-"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* KARTU PERSENTASE KEHADIRAN BULAN INI */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        Persentase Kehadiranmu
                      </h3>
                      <p className="text-[11px] text-slate-400">Rekap performa piket bulan ini</p>
                    </div>
                  </div>
                  <span className="text-xl font-black text-indigo-600">{stats.persentase}%</span>
                </div>

                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      stats.persentase >= 80
                        ? "bg-emerald-500"
                        : stats.persentase >= 50
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                    style={{ width: `${stats.persentase}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="bg-emerald-50/70 rounded-xl p-2 border border-emerald-100">
                    <span className="text-sm font-extrabold text-emerald-700 block">{stats.hadir}</span>
                    <span className="text-[10px] font-semibold text-emerald-600">Hadir</span>
                  </div>
                  <div className="bg-amber-50/70 rounded-xl p-2 border border-amber-100">
                    <span className="text-sm font-extrabold text-amber-700 block">{stats.izin}</span>
                    <span className="text-[10px] font-semibold text-amber-600">Izin</span>
                  </div>
                  <div className="bg-rose-50/70 rounded-xl p-2 border border-rose-100">
                    <span className="text-sm font-extrabold text-rose-700 block">{stats.alfa}</span>
                    <span className="text-[10px] font-semibold text-rose-600">Alfa</span>
                  </div>
                </div>
              </div>

              {/* Banner Notifikasi Jika Ada Permintaan Tukar Jadwal Masuk */}
              {pendingMasukCount > 0 && (
                <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold text-violet-900">
                      Ada {pendingMasukCount} Permintaan Tukar Jadwal!
                    </p>
                    <p className="text-[11px] text-violet-700 mt-0.5">
                      Rekan pengurus meminta konfirmasi tukar hari piket denganmu.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMainSection("jadwal")}
                    className="bg-violet-600 hover:bg-violet-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition"
                  >
                    Cek Sekarang
                  </button>
                </div>
              )}

              {timeReady && (
                <div
                  className={`p-4 rounded-2xl border flex items-start gap-3 shadow-sm ${
                    bisaIsiAbsen
                      ? "bg-emerald-50/90 border-emerald-200 text-emerald-900"
                      : "bg-amber-50/90 border-amber-200 text-amber-900"
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl shrink-0 ${
                      bisaIsiAbsen ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                    }`}
                  >
                    {bisaIsiAbsen ? <UserCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="font-bold text-sm">
                      {bisaIsiAbsen
                        ? `Hari Ini (${hariIni}) Jadwal Piketmu!`
                        : alasanTerkunci.judul}
                    </h2>
                    <p className="text-xs mt-1 opacity-85 leading-relaxed">
                      {bisaIsiAbsen
                        ? "Silakan selesaikan checklist kebersihan dan unggah foto bukti sekre sebelum pukul 17.00 WIB."
                        : alasanTerkunci.deskripsi}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* KOLOM KANAN: Form Lapor Piket / Ajukan Izin */}
            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-2 bg-slate-200/80 p-1.5 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  disabled={!bisaIsiAbsen}
                  onClick={() => setActiveTab("hadir")}
                  className={`py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition disabled:cursor-not-allowed ${
                    activeTab === "hadir"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <CheckSquare className="w-4 h-4" /> Lapor Piket
                </button>
                <button
                  type="button"
                  disabled={!bisaIsiAbsen}
                  onClick={() => setActiveTab("izin")}
                  className={`py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition disabled:cursor-not-allowed ${
                    activeTab === "izin"
                      ? "bg-white text-amber-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <FileText className="w-4 h-4" /> Ajukan Izin
                </button>
              </div>

              {message && (
                <div
                  className={`p-4 rounded-2xl text-sm font-semibold flex items-center gap-2.5 border ${
                    message.type === "ok"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-rose-50 border-rose-200 text-rose-700"
                  }`}
                >
                  {message.type === "ok" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                  <span>{message.text}</span>
                </div>
              )}

              <div className="relative">
                {timeReady && !bisaIsiAbsen && (
                  <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-[3px] rounded-3xl border-2 border-dashed border-amber-300 flex flex-col items-center justify-center p-6 sm:p-10 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center mb-4 shadow-lg shadow-amber-500/25">
                      <Lock className="w-8 h-8" />
                    </div>
                    <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl max-w-sm">
                      {alasanTerkunci.judul}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md leading-relaxed">
                      {alasanTerkunci.deskripsi}
                    </p>
                  </div>
                )}

                <form
                  onSubmit={handleSubmit}
                  className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm"
                >
                  <fieldset disabled={!bisaIsiAbsen} className="space-y-6 disabled:opacity-50">
                    {activeTab === "hadir" ? (
                      <>
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-extrabold text-slate-800">
                              1. Checklist Kebersihan Sekre
                            </label>
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                              {checklist.length}/{TUGAS_PIKET.length} Selesai ({progressPersen}%)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3.5">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
                              style={{ width: `${progressPersen}%` }}
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {TUGAS_PIKET.map((item) => {
                              const checked = checklist.includes(item);
                              return (
                                <label
                                  key={item}
                                  className={`flex items-start gap-3 p-3.5 rounded-2xl border text-xs sm:text-sm cursor-pointer transition ${
                                    checked
                                      ? "bg-indigo-50/70 border-indigo-300 text-indigo-950 font-semibold"
                                      : "bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleTugas(item)}
                                    className="mt-0.5 w-4 h-4 rounded text-indigo-600 accent-indigo-600 shrink-0"
                                  />
                                  <span className="leading-snug">{item}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-extrabold text-slate-800 block mb-2.5">
                            2. Foto Bukti Sekre Rapi (Live Kamera)
                          </label>
                          <CameraWatermark
                            userName={user.nama}
                            onCapture={(file) => setFotoSekre(file)}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Kategori Izin
                          </label>
                          <select
                            value={jenisIzin}
                            onChange={(e) => setJenisIzin(e.target.value)}
                            className="w-full mt-1.5 border border-slate-200 focus:border-amber-500 outline-none rounded-xl px-4 py-3 text-sm bg-white"
                          >
                            <option value="Sakit">Sakit</option>
                            <option value="Akademik/Lomba">Keperluan Kuliah / Lomba</option>
                            <option value="Keluarga">Acara / Urusan Keluarga</option>
                            <option value="Lainnya">Lainnya</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Alasan Singkat
                          </label>
                          <textarea
                            rows={3}
                            required
                            value={alasanIzin}
                            onChange={(e) => setAlasanIzin(e.target.value)}
                            placeholder="Jelaskan alasan tidak bisa hadir piket..."
                            className="w-full mt-1.5 border border-slate-200 focus:border-amber-500 outline-none rounded-xl px-4 py-3 text-sm"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                            Foto Bukti Pendukung (Wajib)
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            required
                            onChange={(e) => setFotoIzin(e.target.files?.[0] || null)}
                            className="w-full text-sm border border-slate-200 rounded-xl p-2.5 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-amber-100 file:text-amber-800 file:font-bold hover:file:bg-amber-200 transition"
                          />
                          <p className="text-[11px] text-slate-400 mt-1.5">
                            Unggah foto surat dokter, jadwal kuliah pengganti, atau bukti pendukung lainnya.
                          </p>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || !bisaIsiAbsen}
                      className={`w-full text-white font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.99] disabled:bg-slate-400 disabled:shadow-none ${
                        activeTab === "hadir"
                          ? "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-indigo-500/25"
                          : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25"
                      }`}
                    >
                      <Send className="w-4 h-4" />
                      {loading
                        ? "Mengirim Data..."
                        : activeTab === "hadir"
                        ? "Kirim Laporan Piket"
                        : "Kirim Pengajuan Izin"}
                    </button>
                  </fieldset>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* BAGIAN 2: DIREKTORI JADWAL PENGURUS & SISTEM TUKAR JADWAL      */}
        {/* ============================================================== */}
        {mainSection === "jadwal" && (
          <div className="space-y-6">
            {tukarFeedback && (
              <div
                className={`p-4 rounded-2xl text-sm font-semibold flex items-center gap-2.5 border ${
                  tukarFeedback.type === "ok"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-700"
                }`}
              >
                {tukarFeedback.type === "ok" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <span>{tukarFeedback.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Kotak Pengajuan Masuk & Riwayat Pengajuan Keluar (7 Kolom) */}
              <div className="lg:col-span-7 space-y-5">
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                          Permintaan Tukar Jadwal Masuk
                        </h2>
                        {pendingMasukCount > 0 && (
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[11px] font-extrabold">
                            {pendingMasukCount} Menunggu
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        Konfirmasi jika kamu bersedia bertukar hari piket dengan rekan pengurus
                      </p>
                    </div>

                    {tukarMasuk.length > 0 && (
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchPermintaanTukar}
                          onChange={(e) => setSearchPermintaanTukar(e.target.value)}
                          placeholder="Cari nama / NIM / hari..."
                          className="w-full sm:w-48 border border-slate-200 focus:border-indigo-500 outline-none rounded-xl pl-8 pr-3 py-1.5 text-xs bg-slate-50"
                        />
                      </div>
                    )}
                  </div>

                  {filteredTukarMasuk.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400">
                      {tukarMasuk.length === 0
                        ? "Belum ada pengajuan tukar jadwal yang masuk kepadamu."
                        : "Tidak ada permintaan tukar yang cocok dengan pencarian."}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredTukarMasuk.map((item) => (
                        <div
                          key={item.id}
                          className={`p-4 rounded-2xl border transition ${
                            item.status === "pending"
                              ? "bg-violet-50/60 border-violet-200"
                              : "bg-slate-50 border-slate-200/70"
                          }`}
                        >
                          <div className="flex flex-wrap justify-between items-start gap-2">
                            <div>
                              <p className="font-extrabold text-sm text-slate-900">
                                {item.pemohon.nama}{" "}
                                <span className="text-xs font-mono font-normal text-slate-500">
                                  ({item.pemohon.nim})
                                </span>{" "}
                                <span className="text-xs font-semibold text-indigo-600">
                                  • {item.pemohon.divisi}
                                </span>
                              </p>
                              <p className="text-xs text-slate-600 mt-1">
                                Mengajak tukar: Hari{" "}
                                <strong className="text-indigo-700">{item.hariPemohon}</strong>{" "}
                                (miliknya) ↔ Hari{" "}
                                <strong className="text-violet-700">{item.hariTujuan}</strong>{" "}
                                (milikmu)
                              </p>
                            </div>

                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                                item.status === "pending"
                                  ? "bg-amber-100 text-amber-800"
                                  : item.status === "disetujui"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              {item.status}
                            </span>
                          </div>

                          <p className="text-xs bg-white p-2.5 rounded-xl border border-slate-200/70 text-slate-600 mt-2.5">
                            <strong>Alasan:</strong> “{item.alasan}”
                          </p>

                          {item.status === "pending" && (
                            <div className="flex gap-2.5 mt-3">
                              <button
                                type="button"
                                onClick={() => handleKonfirmasiTukar(item.id, "setuju")}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                              >
                                <Check className="w-4 h-4" /> Setuju & Tukar Otomatis
                              </button>
                              <button
                                type="button"
                                onClick={() => handleKonfirmasiTukar(item.id, "tolak")}
                                className="flex-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                              >
                                <X className="w-4 h-4" /> Tidak Setuju
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {tukarKeluar.length > 0 && (
                  <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-3">
                    <h3 className="text-sm font-extrabold text-slate-800">
                      Riwayat Pengajuan Tukar Jadwalmu
                    </h3>
                    <div className="space-y-2">
                      {tukarKeluar.map((item) => (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-wrap justify-between items-center gap-2 text-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-800">
                              Ke: {item.tujuan.nama}{" "}
                              <span className="font-mono font-normal text-slate-500">
                                ({item.tujuan.nim})
                              </span>{" "}
                              • {item.tujuan.divisi}
                            </p>
                            <p className="text-slate-500 mt-0.5">
                              {item.hariPemohon} ↔ {item.hariTujuan} • “{item.alasan}”
                            </p>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                              item.status === "pending"
                                ? "bg-amber-100 text-amber-800"
                                : item.status === "disetujui"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {item.status === "pending"
                              ? "Menunggu Konfirmasi"
                              : item.status === "disetujui"
                              ? "Disetujui (Tertukar)"
                              : "Ditolak"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Form Ajukan Tukar Jadwal (Hanya Bisa ke Hari yang Belum Lewat) */}
              <form
                onSubmit={handleAjukanTukar}
                className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <ArrowLeftRight className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">Ajukan Tukar Jadwal</h2>
                    <p className="text-xs text-slate-500">
                      Jadwalmu saat ini:{" "}
                      <strong className="text-indigo-600">
                        {hariPiketSaya || "Belum diatur"}
                      </strong>
                    </p>
                  </div>
                </div>

                {jadwalSayaSudahLewat ? (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                    <p className="font-extrabold flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                      Jadwal Piketmu Minggu Ini Sudah Lewat
                    </p>
                    <p className="leading-relaxed opacity-90">
                      Karena jadwal piketmu (<strong>{hariPiketSaya}</strong>) sudah berlalu untuk minggu ini, pengajuan tukar jadwal terkunci hingga jadwal minggu depan dibagikan.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Input Pencarian Rekan Pengurus (Nama, NIM, Departemen, Hari) */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Cari & Pilih Rekan Pengurus Tujuan
                      </label>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Hanya menampilkan jadwal pada hari yang belum terlewati
                      </p>
                      <div className="relative mt-1.5">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchTukarTarget}
                          onChange={(e) => handleSearchTukarChange(e.target.value)}
                          placeholder="Ketik NIM, nama, departemen, atau hari..."
                          className="w-full border border-slate-200 focus:border-indigo-500 outline-none rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/70"
                        />
                      </div>

                      <select
                        required
                        value={tujuanId}
                        onChange={(e) => setTujuanId(e.target.value)}
                        className="w-full mt-2 border border-slate-200 focus:border-indigo-500 outline-none rounded-xl px-3.5 py-3 text-xs sm:text-sm bg-white"
                      >
                        <option value="">
                          -- Pilih Pengurus ({kandidatTukarFiltered.length} tersedia) --
                        </option>
                        {kandidatTukarFiltered.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.hari} — {u.nama} ({u.nim} • {u.divisi})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Alasan Tukar Jadwal
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={alasanTukar}
                        onChange={(e) => setAlasanTukar(e.target.value)}
                        placeholder="Contoh: Ada bentrok jadwal praktikum / kegiatan di hari tersebut..."
                        className="w-full mt-1.5 border border-slate-200 focus:border-indigo-500 outline-none rounded-xl px-3.5 py-2.5 text-sm"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={tukarLoading || !hariPiketSaya || kandidatTukarFiltered.length === 0}
                      className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition"
                    >
                      <Send className="w-4 h-4" />
                      {tukarLoading ? "Mengirim Pengajuan..." : "Kirim Permintaan Tukar"}
                    </button>
                  </>
                )}
              </form>
            </div>

            {/* DIREKTORI JADWAL SELURUH PENGURUS (DENGAN PENCARIAN NIM, NAMA, DEPT, HARI) */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    Jadwal Piket Seluruh Pengurus
                  </h2>
                  <p className="text-xs text-slate-500">
                    Cari berdasarkan nama, NIM, atau filter berdasarkan hari maupun departemen
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  {/* Search Bar Direktori */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchDirektori}
                      onChange={(e) => setSearchDirektori(e.target.value)}
                      placeholder="Cari NIM, nama, dept, hari..."
                      className="w-full sm:w-60 border border-slate-200 focus:border-indigo-500 outline-none rounded-xl pl-9 pr-3 py-2 text-xs font-medium bg-slate-50"
                    />
                  </div>

                  <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl shrink-0">
                    <button
                      type="button"
                      onClick={() => setJadwalViewMode("hari")}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        jadwalViewMode === "hari"
                          ? "bg-white text-indigo-600 shadow-sm"
                          : "text-slate-600"
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" /> Per Hari
                    </button>
                    <button
                      type="button"
                      onClick={() => setJadwalViewMode("departemen")}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        jadwalViewMode === "departemen"
                          ? "bg-white text-indigo-600 shadow-sm"
                          : "text-slate-600"
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" /> Per Departemen
                    </button>
                  </div>
                </div>
              </div>

              {jadwalViewMode === "hari" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {HARI_KERJA.map((hari) => {
                    const members = filteredDirektoriSchedules.filter((u) => u.hari === hari);
                    return (
                      <div
                        key={hari}
                        className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5"
                      >
                        <div className="flex justify-between items-center pb-2 mb-2.5 border-b border-slate-200">
                          <span className="font-extrabold text-xs text-indigo-700 uppercase tracking-wider">
                            {hari}
                          </span>
                          <span className="text-[11px] font-bold bg-white px-2 py-0.5 rounded-md border text-slate-600">
                            {members.length} org
                          </span>
                        </div>
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                          {members.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">Tidak ada data</p>
                          ) : (
                            members.map((m) => (
                              <div
                                key={m.id}
                                className={`p-2.5 rounded-xl border ${
                                  m.id === user.id
                                    ? "bg-indigo-50 border-indigo-300"
                                    : "bg-white border-slate-100"
                                }`}
                              >
                                <p className="text-xs font-bold text-slate-900 leading-snug">
                                  {m.nama} {m.id === user.id && "(Kamu)"}
                                </p>
                                <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                  {m.nim}
                                </p>
                                <p className="text-[10px] font-semibold text-indigo-600">
                                  {m.divisi}
                                </p>
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
                    const members = filteredDirektoriSchedules.filter(
                      (u) => u.divisi.toLowerCase() === dept.toLowerCase()
                    );
                    if (searchDirektori.trim() && members.length === 0) return null;
                    return (
                      <div
                        key={dept}
                        className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4"
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
                            <p className="text-xs text-slate-400 italic">Belum ada anggota</p>
                          ) : (
                            members.map((m) => (
                              <div
                                key={m.id}
                                className="bg-white p-2.5 rounded-xl border border-slate-100 flex justify-between items-center gap-2"
                              >
                                <div>
                                  <p className="text-xs font-bold text-slate-900">{m.nama}</p>
                                  <p className="text-[10px] font-mono text-slate-400">{m.nim}</p>
                                </div>
                                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-extrabold text-[11px] shrink-0">
                                  {m.hari}
                                </span>
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
          </div>
        )}
      </main>
    </div>
  );
}