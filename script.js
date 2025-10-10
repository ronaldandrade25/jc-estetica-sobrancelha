// =========================
// Firebase (CDN, SDK modular)
// =========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    serverTimestamp,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 🔐 Mesmo projeto do painel
const firebaseConfig = {
    apiKey: "AIzaSyC-tF920g3mumZ8SZyGN1gTzUJoTSddCX0",
    authDomain: "jc-estetica-sobrancelhas.firebaseapp.com",
    projectId: "jc-estetica-sobrancelhas",
    storageBucket: "jc-estetica-sobrancelhas.firebasestorage.app",
    messagingSenderId: "831081045593",
    appId: "1:831081045593:web:7d2fd3504098f312035b48",
    measurementId: "G-MNEPHN99M9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =========================
// Toast simples
// =========================
function toast(msg, type = "ok", ms = 2600) {
    const t = document.getElementById("toast");
    if (!t) { alert(msg); return; }
    t.textContent = msg;
    t.className = `toast toast--${type === "ok" ? "ok" : "err"} toast--show`;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("toast--show"), ms);
}

// =========================
// Reveal ao rolar (mantido)
// =========================
(function () {
    const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
        });
    }, { threshold: .15 });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
})();

// =========================
// Modal de agendamento
// =========================
(function () {
    const modal = document.getElementById('modal-agendar');
    const openers = document.querySelectorAll('[data-agendar]');
    const closers = modal.querySelectorAll('[data-close]');
    const dataEl = document.getElementById('ag-data');
    const horaEl = document.getElementById('ag-hora');
    const nomeEl = document.getElementById('ag-nome');
    const servicoEl = document.getElementById('ag-servico');
    const profEl = document.getElementById('ag-prof');
    const btnConfirma = document.getElementById('ag-confirmar');

    // Horários fixos 08:00–22:00 (de 1 em 1 hora)
    const HORARIOS_FIXOS = [];
    for (let h = 8; h <= 22; h++) HORARIOS_FIXOS.push(String(h).padStart(2, '0') + ':00');

    function resetHorariosPlaceholder(text = 'Selecione uma data primeiro') {
        horaEl.innerHTML = `<option value="">${text}</option>`;
    }

    // Data mínima: hoje
    function setMinHoje() {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dataEl.min = `${yyyy}-${mm}-${dd}`;
    }

    // Busca horários ocupados e preenche apenas os livres
    async function populaHorariosLivres(dataISO) {
        if (!dataISO) { resetHorariosPlaceholder(); return; }
        horaEl.innerHTML = '<option value="">Carregando...</option>';

        try {
            const q = query(collection(db, "agendamentos"), where("dataISO", "==", dataISO));
            const snap = await getDocs(q);

            // considera ocupados tanto agendamentos quanto bloqueios
            const ocupados = new Set();
            snap.forEach(d => {
                const v = d.data();
                const h = (v.hora || '').trim();
                if (h) ocupados.add(h);
            });

            const livres = HORARIOS_FIXOS.filter(h => !ocupados.has(h));
            if (!livres.length) { resetHorariosPlaceholder('Nenhum horário disponível'); return; }

            horaEl.innerHTML =
                '<option value="">Selecione um horário</option>' +
                livres.map(h => `<option>${h}</option>`).join('');
        } catch (err) {
            console.error('[Horários] Erro ao consultar Firestore:', err);
            resetHorariosPlaceholder('Erro ao carregar horários');
        }
    }

    function abrirModal(contexto = {}) {
        if (contexto.prof) profEl.value = contexto.prof;
        modal.classList.add('is-open');
        modal.removeAttribute('aria-hidden');
        dataEl.focus();
        document.addEventListener('keydown', escHandler);
        resetHorariosPlaceholder();
    }

    function fecharModal() {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.removeEventListener('keydown', escHandler);
    }

    function escHandler(e) { if (e.key === 'Escape') fecharModal(); }

    // Abre modal
    openers.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const prof = btn.getAttribute('data-prof') || '';
            abrirModal({ prof });
        });
    });

    // Fecha modal
    closers.forEach(b => b.addEventListener('click', fecharModal));
    modal.addEventListener('click', (e) => { if (e.target === modal) fecharModal(); });

    // Ao mudar a data → recarrega horários
    dataEl.addEventListener('change', (e) => {
        populaHorariosLivres(e.target.value);
    });

    // Confirmar → checa / salva → WhatsApp
    btnConfirma.addEventListener('click', async () => {
        const dataISO = dataEl.value;
        const hora = horaEl.value;
        const nome = (nomeEl.value || '').trim();

        // validações
        const invalidados = [];
        if (!dataISO) invalidados.push(dataEl);
        if (!hora) invalidados.push(horaEl);
        if (!nome) invalidados.push(nomeEl);

        if (invalidados.length) {
            invalidados.forEach(el => {
                el.style.boxShadow = '0 0 0 2px #ff6464';
                setTimeout(() => el.style.boxShadow = 'none', 700);
            });
            toast("Preencha data, horário e seu nome.", "err");
            return;
        }

        const servico = servicoEl.value || '—';
        const prof = profEl.value || '—';

        const dt = new Date(dataISO + 'T00:00:00');
        const dataFormatada = dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

        btnConfirma.disabled = true;
        btnConfirma.textContent = 'Enviando...';

        try {
            // Checagem de conflito (considera bloqueios também)
            const q = query(
                collection(db, "agendamentos"),
                where("dataISO", "==", dataISO),
                where("hora", "==", hora)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
                toast("Esse horário acabou de ser preenchido. Escolha outro.", "err");
                await populaHorariosLivres(dataISO);
                return;
            }

            // Salvar no Firestore
            await addDoc(collection(db, "agendamentos"), {
                dataISO,
                hora,                  // exemplo: "08:00" ... "22:00"
                servico,
                profissional: prof,
                cliente: nome,
                clienteNome: nome,
                status: "pendente",
                source: "site",
                createdAt: serverTimestamp(),
            });

            // Mensagem WhatsApp
            const msg =
                `Olá! Gostaria de confirmar meu agendamento:%0A%0A` +
                `• Nome: ${encodeURIComponent(nome)}%0A` +
                `• Serviço: ${encodeURIComponent(servico)}%0A` +
                `• Profissional: ${encodeURIComponent(prof)}%0A` +
                `• Data: ${encodeURIComponent(dataFormatada)}%0A` +
                `• Horário: ${encodeURIComponent(hora)}`;

            const url = `https://wa.me/5581987285168?text=${msg}`;
            toast("Agendamento registrado. Abrindo WhatsApp...", "ok", 1500);

            setTimeout(() => {
                window.location.assign(url);
                fecharModal();
            }, 600);
        } catch (err) {
            console.error(err);
            toast("Não foi possível salvar o agendamento. Tente novamente.", "err");
        } finally {
            btnConfirma.disabled = false;
            btnConfirma.textContent = 'Confirmar no WhatsApp';
        }
    });

    // Init
    setMinHoje();
})();
