import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getAiInstance = () => {
  const apiKey = process.env.GEMINI_API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

const isLeakedKeyError = (err: any): boolean => {
  const msg = err?.message || "";
  return msg.includes("reported as leaked") || msg.includes("API_KEY_INVALID") || msg.includes("403");
};

export const getAiGreeting = async (): Promise<string> => {
  const fallbackGreetings = [
    "Semangat pagi sobat riset! Yuk mulai hari ini dengan ide-ide brilian! 🚀",
    "Inovasi tiada henti, mari kita berkarya bersama UKMPR! ✨",
    "Kolaborasi adalah kunci kesuksesan riset kita. Semangat! 🤝",
    "Masa depan riset ada di tangan kita. Ayo bernalar cerdas! 🧠",
    "Kreativitas tanpa batas, riset tanpa henti. Selamat datang! 🎨"
  ];

  try {
    const ai = getAiInstance();
    const themes = ["semangat pagi", "inovasi", "kolaborasi", "masa depan", "teknologi", "kreativitas"];
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Buat kalimat sapaan selamat datang pendek (1 kalimat) untuk member UKMPR (Unit Kegiatan Mahasiswa Penalaran dan Riset). 
      Tema: ${randomTheme}. 
      Gaya: Gaul, Gen Z, emoji friendly. 
      Jangan kaku.`,
    });
    
    return response.text || fallbackGreetings[0];
  } catch (err) {
    if (isLeakedKeyError(err)) {
      console.warn("Gemini API Key reported as leaked or invalid.");
      throw err;
    } else {
      console.error("AI Greeting Error:", err);
    }
    return fallbackGreetings[Math.floor(Math.random() * fallbackGreetings.length)];
  }
};

export const getAiTips = async (): Promise<string> => {
  const fallbackTips = [
    "Gunakan Mendeley atau Zotero untuk mengelola sitasi karya ilmiahmu agar lebih rapi dan otomatis! 📚",
    "Jangan lupa cek plagiasi karyamu menggunakan Turnitin atau alat serupa sebelum dikirim ke lomba! ✅",
    "Metodologi yang kuat adalah kunci dari penelitian yang kredibel. Pastikan instrumenmu valid! 🔬",
    "Cari gap penelitian dengan membaca minimal 10 jurnal internasional terbaru di bidangmu! 🌍",
    "Visualisasi data yang menarik akan membuat presentasi risetmu jauh lebih profesional! 📊"
  ];

  try {
    const ai = getAiInstance();
    const topics = ["Critical Thinking", "Data Analysis", "Academic Writing", "Public Speaking", "Research Methodology", "Time Management"];
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Berikan 1 tips singkat (maksimal 20 kata) tentang ${randomTopic} untuk mahasiswa peneliti. Gaya santai.`,
    });
    return response.text || fallbackTips[0];
  } catch (err) {
    if (isLeakedKeyError(err)) {
      console.warn("Gemini API Key reported as leaked or invalid. Using fallback.");
    } else {
      console.error("AI Tips Error:", err);
    }
    return fallbackTips[Math.floor(Math.random() * fallbackTips.length)];
  }
};

export interface NewsItem {
  title: string;
  category: string;
  summary: string;
  content: string;
  image: string;
}

export const getAiNews = async (): Promise<NewsItem[]> => {
  const fallbackNews: NewsItem[] = [
    {
      title: "Apa sebenarnya tujuan dari penelitian?",
      category: "Metodologi Riset",
      summary: "Menjelaskan esensi dasar mengapa sebuah penelitian dilakukan dan apa output yang diharapkan dari sebuah proses ilmiah.",
      content: `Penelitian pada dasarnya adalah sebuah upaya sistematis untuk mencari kebenaran atau memecahkan masalah yang ada di masyarakat. Tujuan utama dari penelitian bukanlah sekadar untuk memenuhi syarat kelulusan atau menambah daftar pustaka, melainkan untuk memberikan kontribusi nyata bagi pengembangan ilmu pengetahuan dan peradaban manusia. Secara filosofis, penelitian bertujuan untuk menjawab rasa ingin tahu manusia yang tidak terbatas. Melalui metode yang terukur, penelitian membantu kita memahami fenomena yang sebelumnya gelap menjadi terang benderang.`,
      image: "https://loremflickr.com/800/600/research,goal"
    },
  ];

  try {
    const ai = getAiInstance();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Buat 5 artikel ilmiah mendalam mengenai metodologi penelitian dengan judul-judul spesifik berikut:
      1. Apa sebenarnya tujuan dari penelitian?
      2. Filsafat ilmu penelitian
      3. Metode penelitian dan jenis penelitian serta contoh kasus
      4. Cara menentukan pain point suatu penelitian sehingga menghasilkan solusi nyata
      5. Cara mengatasi kesulitan mencari data dari suatu permasalahan yang diangkat untuk penelitian

      Format JSON: [{title, category, summary, content, image}]. 
      
      SYARAT KONTEN:
      1. Content HARUS SANGAT PANJANG (minimal 400-500 kata per artikel).
      2. Gunakan bahasa Indonesia yang akademis, formal, namun tetap mudah dipahami mahasiswa.
      3. Kategori gunakan 'Metodologi Riset'.
      4. Summary harus merangkum inti artikel dalam 2 kalimat.
      5. Image gunakan URL: https://loremflickr.com/800/600/research,library,science (berikan variasi sedikit pada keyword agar gambar berbeda).
      
      Pastikan valid JSON dan penuhi kuota kata.`,
      config: { 
        responseMimeType: "application/json",
      },
    });
    
    return JSON.parse(response.text || "[]");
  } catch (err) {
    if (isLeakedKeyError(err)) {
      console.warn("Gemini API Key reported as leaked or invalid. Using fallback.");
    } else {
      console.error("AI News Error:", err);
    }
    return fallbackNews;
  }
};

export const brainstormInitiate = async (nickname: string, topic: string, problem: string, location: string): Promise<string> => {
  const initialPrompt = `
    Analisa potensi penelitian berdasarkan data berikut:
    Nama Panggilan: ${nickname}
    Topik Riset: ${topic}
    Masalah yang dicari: ${problem}
    Lokasi: ${location}

    Berikan analisa mendalam terbagi menjadi 2 metode penelitian:
    1. Kualitatif: Jelaskan pendekatan dan potensi judul.
    2. RnD (Research and Development): Arahkan untuk membuat aplikasi digital atau solusi teknologi, jelaskan fitur utamanya.

    Gunakan gaya bahasa "Suhu UKMPR": Berpengalaman 10 tahun penelitian, juara nasional KTI, inovatif, visioner, kritis, dan sangat detail. Langsung ke inti pembahasan, hindari basa-basi, intro, atau kesimpulan yang panjang. Fokus pada insight teknis dan praktis. Sapa user dengan nama panggilannya.
  `;

  try {
    const ai = getAiInstance();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: initialPrompt,
    });
    return response.text || "Gagal menghasilkan analisa.";
  } catch (err) {
    console.error("AI Brainstorm Init Error:", err);
    throw err;
  }
};

export const brainstormMessage = async (message: string, history: { role: string, content: string }[]): Promise<string> => {
  try {
    const ai = getAiInstance();
    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: `Anda adalah "Suhu UKMPR": Berpengalaman 10 tahun penelitian, juara nasional KTI, inovatif, visioner, kritis, dan sangat detail. Fokus pada insight teknis dan praktis. Gunakan bahasa Indonesia yang santai namun berbobot.`,
      },
      history: history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
      }))
    });

    const response = await chat.sendMessage({ message });
    return response.text || "Gagal menghasilkan respon.";
  } catch (err) {
    console.error("AI Brainstorm Message Error:", err);
    throw err;
  }
};
