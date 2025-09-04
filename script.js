// Revela elementos ao rolar (se você já usava, mantém)
(function () {
    const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
        });
    }, { threshold: .15 });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
})();

// Modal de agendamento (data + horário) → WhatsApp
(function () {
    const modal = document.getElementById('modal-agendar');
    const openers = document.querySelectorAll('[data-agendar]');
    const closers = modal.querySelectorAll('[data-close]');
    const dataEl = document.getElementById('ag-data');
    const horaEl = document.getElementById('ag-hora');
    const servicoEl = document.getElementById('ag-servico');
    const profEl = document.getElementById('ag-prof');
    const btnConfirma = document.getElementById('ag-confirmar');

    // Gera horários 09:00–19:00 a cada 30 minutos
    function populaHorarios() {
        const opts = [];
        for (let h = 9; h <= 19; h++) {
            for (let m of [0, 30]) {
                const label = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
                opts.push(label);
            }
        }
        horaEl.innerHTML = '<option value="">Selecione um horário</option>' +
            opts.map(h => `<option>${h}</option>`).join('');
    }

    // Data mínima: hoje
    function setMinHoje() {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dataEl.min = `${yyyy}-${mm}-${dd}`;
    }

    function abrirModal(contexto = {}) {
        if (contexto.prof) profEl.value = contexto.prof;
        modal.classList.add('is-open');
        modal.removeAttribute('aria-hidden');
        dataEl.focus();
        document.addEventListener('keydown', escHandler);
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

    // Confirmar → WhatsApp
    btnConfirma.addEventListener('click', () => {
        const data = dataEl.value;
        const hora = horaEl.value;
        if (!data || !hora) {
            [dataEl, horaEl].forEach(el => {
                el.style.boxShadow = '0 0 0 2px #ff6464';
                setTimeout(() => el.style.boxShadow = 'none', 700);
            });
            return;
        }
        const servico = servicoEl.value || '—';
        const prof = profEl.value || '—';

        // Formata data pt-BR
        const dt = new Date(data + 'T00:00:00');
        const dataFormatada = dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

        const msg = `Olá! Gostaria de confirmar meu agendamento:%0A%0A• Serviço: ${encodeURIComponent(servico)}%0A• Profissional: ${encodeURIComponent(prof)}%0A• Data: ${encodeURIComponent(dataFormatada)}%0A• Horário: ${encodeURIComponent(hora)}`;
        const url = `https://wa.me/5581996221060?text=${msg}`;
        window.open(url, '_blank', 'noopener');
        fecharModal();
    });

    // Init
    populaHorarios();
    setMinHoje();
})();
