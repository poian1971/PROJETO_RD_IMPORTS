// ============================================================
// 1. CONFIGURAÇÃO E INICIALIZAÇÃO DO FIREBASE (FIRESTORE)
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyB2SwByAunkI7FFqFJZgOrnTY2tzS0TFI4",
    authDomain: "rd-imports-caxias-do-sul.firebaseapp.com",
    projectId: "rd-imports-caxias-do-sul",
    storageBucket: "rd-imports-caxias-do-sul.firebasestorage.app",
    messagingSenderId: "371753503350",
    appId: "1:371753503350:web:bc9b4ed65f14ab06fa2d57",
    measurementId: "G-0KYTEDX540"
};

// Inicializa a aplicação Firebase e conecta ao banco Firestore
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Variáveis globais para armazenar dados carregados da nuvem
let produtos = [];
let servicos = [];
let linkMPAtual = "";

// ============================================================
// 2. FUNÇÕES AUXILIARES DE FORMATAÇÃO
// ============================================================

// Converte links normais do Google Drive em links de imagem direta (lh3.googleusercontent.com/d/...)
function formatarUrlGoogleDrive(url) {
    if (!url) return '';
    url = url.trim();

    if (url.includes('drive.google.com/file/d/')) {
        const matches = url.match(/\/d\/([^\/]+)/);
        if (matches && matches[1]) {
            return `https://lh3.googleusercontent.com/d/${matches[1]}`;
        }
    }
    if (url.includes('drive.google.com/open?id=')) {
        const matches = url.match(/id=([^&]+)/);
        if (matches && matches[1]) {
            return `https://lh3.googleusercontent.com/d/${matches[1]}`;
        }
    }
    return url;
}

// Formatador automático para preços de serviços ("A partir de R$ XX,XX")
function formatarPrecoServico(valor) {
    if (!valor) return 'Consulte valores';
    let str = valor.toString().trim();

    // Mantém textos especiais como 'Consulte valores' sem alterar
    if (str.toLowerCase().includes('consulte')) return str;

    // Remove prefixos existentes para não duplicar se já foi formatado antes
    str = str.replace(/^A partir de\s*/i, '').replace(/^R\$\s*/i, '').trim();

    // Se for numérico ou formatado com vírgula (ex: 150 ou 150,00), adiciona o prefixo padrão
    if (/^[\d.,]+$/.test(str)) {
        return `A partir de R$ ${str}`;
    }

    return str;
}

// ============================================================
// 3. CONSULTAS AO BANCO DE DADOS (USANDO .GET() PARA ECONOMIA DE LEITURAS)
// ============================================================

// BUSCA DE PRODUTOS (Ordem Alfabética por 'name' e com .get())
function buscarProdutos() {
    db.collection('produtos').orderBy('name', 'asc').get().then(snapshot => {
        produtos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProdutosPagina();
        renderDestaques();
        renderAdminProdutos();
    }).catch(error => console.error("Erro ao buscar produtos no Firebase:", error));
}

// BUSCA DE SERVIÇOS (Usa .get() para economizar leituras)
function buscarServicos() {
    db.collection('servicos').orderBy('createdAt', 'asc').get().then(snapshot => {
        servicos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderServicos();
        renderAdminServicos();
    }).catch(error => console.error("Erro ao buscar serviços no Firebase:", error));
}

// Executa a busca inicial dos dados assim que a página carrega
document.addEventListener('DOMContentLoaded', () => {
    buscarProdutos();
    buscarServicos();
});

// ============================================================
// 4. ALTERNÂNCIA DE MÓDULOS NO PAINEL ADMIN (CELULARES / SERVIÇOS)
// ============================================================
function alternarModuloAdmin(modulo) {
    const modProdutos = document.getElementById('modulo-admin-produtos');
    const modServicos = document.getElementById('modulo-admin-servicos');
    const btnProdutos = document.getElementById('tab-btn-produtos');
    const btnServicos = document.getElementById('tab-btn-servicos');

    if (modulo === 'produtos') {
        if (modProdutos) modProdutos.style.display = 'block';
        if (modServicos) modServicos.style.display = 'none';
        if (btnProdutos) btnProdutos.className = 'btn';
        if (btnServicos) btnServicos.className = 'btn btn-outline';
        renderAdminProdutos();
    } else {
        if (modProdutos) modProdutos.style.display = 'none';
        if (modServicos) modServicos.style.display = 'block';
        if (btnProdutos) btnProdutos.className = 'btn btn-outline';
        if (btnServicos) btnServicos.className = 'btn';
        renderAdminServicos();
    }
}

// ============================================================
// 5. RENDERIZAÇÃO DE CARDS E VITRINE DE PRODUTOS
// ============================================================
function obterBadgeHTML(category) {
    if (category === 'promocao') return '<span class="card-badge badge-promocao">🔥 Promoção</span>';
    if (category === 'seminovo') return '<span class="card-badge badge-seminovo">📱 Seminovo</span>';
    if (category === 'lacrado') return '<span class="card-badge badge-lacrado">📦 Lacrado</span>';
    return '';
}

function criarCardHTML(p) {
    const badgeHTML = obterBadgeHTML(p.category);
    const precoFormatado = p.price ? (p.price.toString().startsWith('R$') ? p.price : `R$ ${p.price}`) : 'R$ 0,00';
    const nomeSeguro = (p.name || '').replace(/'/g, "\\'");
    const linkMPSeguro = (p.linkMP || '').replace(/'/g, "\\'");

    return `
        <div class="card">
            ${badgeHTML}
            <img src="${p.img}" class="card-img" alt="${p.name}" onerror="this.src='https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600'">
            <div class="card-body">
                <div class="card-content-top">
                    <div class="card-title">${p.name}</div>
                    <div class="card-desc">${p.desc || ''}</div>
                </div>
                <div class="card-footer">
                    <span class="price">${precoFormatado}</span>
                    <button class="btn" style="padding: 8px 14px; font-size: 13px;" onclick="abrirModalMP('${nomeSeguro}', '${precoFormatado}', '${linkMPSeguro}')">Comprar</button>
                </div>
            </div>
        </div>
    `;
}

function renderDestaques() {
    const destaques = document.getElementById('destaques-grid');
    if (!destaques) return;
    destaques.innerHTML = '';
    const destaquesLista = produtos.filter(p => p.category === 'promocao').slice(0, 4);
    destaquesLista.forEach(p => {
        destaques.innerHTML += criarCardHTML(p);
    });
}

function renderProdutosPagina(lista = produtos) {
    const grid = document.getElementById('produtos-grid');
    if (!grid) return;
    grid.innerHTML = '';
    lista.forEach(p => {
        grid.innerHTML += criarCardHTML(p);
    });
}

function filtrarCategoria(categoria, btnElement) {
    const botoes = document.querySelectorAll('.filter-btn');
    botoes.forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    if (categoria === 'todos') {
        renderProdutosPagina(produtos);
    } else {
        const filtrados = produtos.filter(p => p.category === categoria);
        renderProdutosPagina(filtrados);
    }
}

// ============================================================
// 6. RENDERIZAÇÃO DA TABELA PÚBLICA DE SERVIÇOS
// ============================================================
function renderServicos() {
    const tbody = document.getElementById('services-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    servicos.forEach(s => {
        const precoFormatado = formatarPrecoServico(s.price);
        tbody.innerHTML += `
            <tr>
                <td style="font-weight: 600;">${s.name}</td>
                <td style="color: var(--text-gray); font-size: 13px;">${s.desc || ''}</td>
                <td style="text-align: right; font-weight: 700; color: #b45309;">${precoFormatado}</td>
            </tr>
        `;
    });
}

// ============================================================
// 7. GESTÃO DE PRODUTOS NO PAINEL ADMIN
// ============================================================
function renderAdminProdutos() {
    const adminList = document.getElementById('admin-produtos-list');
    if (!adminList) return;
    adminList.innerHTML = '';

    if (produtos.length === 0) {
        adminList.innerHTML = '<p style="font-size: 13px; color: #6b7280; padding: 10px;">Nenhum produto cadastrado.</p>';
        return;
    }

    produtos.forEach((p) => {
        const catAtual = p.category || 'seminovo';
        adminList.innerHTML += `
            <div class="admin-prod-row" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="display: flex; align-items: center; gap: 12px; flex-grow: 1; min-width: 200px;">
                    <img src="${p.img}" alt="" style="width: 45px; height: 45px; object-fit: cover; background:#fff; border-radius: 6px; border: 1px solid #cbd5e1;">
                    <div>
                        <div style="font-weight: 600; font-size: 14px; color: #111827;">${p.name}</div>
                        <div style="font-size: 12px; color: #6b7280;">Preço: R$ ${p.price} | Cat: <strong style="text-transform: capitalize;">${catAtual}</strong></div>
                    </div>
                </div>
                <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                    <button class="btn btn-outline" style="padding: 6px 10px; font-size: 12px;" onclick="preencherFormularioEdicao('${p.id}')">
                        <i class="fa-solid fa-pen-to-square"></i> Editar
                    </button>
                    <select id="edit-cat-${p.id}" class="form-control" style="width: 110px; padding: 5px; font-size: 12px;">
                        <option value="seminovo" ${catAtual === 'seminovo' ? 'selected' : ''}>Seminovo</option>
                        <option value="promocao" ${catAtual === 'promocao' ? 'selected' : ''}>Promoção</option>
                        <option value="lacrado" ${catAtual === 'lacrado' ? 'selected' : ''}>Lacrado</option>
                    </select>
                    <input type="text" id="edit-price-${p.id}" value="${p.price}" class="form-control" style="width: 90px; padding: 5px; font-size: 12px;">
                    <button class="btn" style="padding: 6px 10px; font-size: 12px;" onclick="atualizarProdutoRapido('${p.id}')">Salvar Rápido</button>
                    <button class="btn btn-outline" style="padding: 6px 10px; font-size: 12px; border-color: #dc2626; color: #dc2626;" onclick="removerProduto('${p.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
}

function preencherFormularioEdicao(id) {
    const prod = produtos.find(p => p.id === id);
    if (!prod) return;

    const idEdit = document.getElementById('prod-id-edicao');
    const nameInput = document.getElementById('new-prod-name');
    const priceInput = document.getElementById('new-prod-price');
    const selectCat = document.getElementById('new-prod-category');
    const urlInput = document.getElementById('new-prod-img');
    const linkMpInput = document.getElementById('new-prod-link-mp');
    const descInput = document.getElementById('new-prod-desc');

    if (idEdit) idEdit.value = prod.id;
    if (nameInput) nameInput.value = prod.name || '';
    if (priceInput) priceInput.value = prod.price || '';
    if (selectCat) selectCat.value = prod.category || 'seminovo';
    if (urlInput) urlInput.value = prod.img || '';
    if (linkMpInput) linkMpInput.value = prod.linkMP || '';
    if (descInput) descInput.value = prod.desc || '';

    const formTitle = document.getElementById('form-titulo');
    const btnSalvar = document.getElementById('btn-salvar-prod');
    const btnCancelar = document.getElementById('btn-cancelar-edicao');

    if (formTitle) formTitle.innerText = 'Editar Celular';
    if (btnSalvar) btnSalvar.innerText = 'Salvar Alterações';
    if (btnCancelar) btnCancelar.style.display = 'inline-block';

    window.scrollTo({ top: (formTitle ? formTitle.offsetTop - 100 : 0), behavior: 'smooth' });
}

function limparFormularioAdmin() {
    const idEdit = document.getElementById('prod-id-edicao');
    const nameInput = document.getElementById('new-prod-name');
    const priceInput = document.getElementById('new-prod-price');
    const selectCat = document.getElementById('new-prod-category');
    const urlInput = document.getElementById('new-prod-img');
    const linkMpInput = document.getElementById('new-prod-link-mp');
    const descInput = document.getElementById('new-prod-desc');

    if (idEdit) idEdit.value = '';
    if (nameInput) nameInput.value = '';
    if (priceInput) priceInput.value = '';
    if (selectCat) selectCat.value = 'seminovo';
    if (urlInput) urlInput.value = '';
    if (linkMpInput) linkMpInput.value = '';
    if (descInput) descInput.value = '';

    const formTitle = document.getElementById('form-titulo');
    const btnSalvar = document.getElementById('btn-salvar-prod');
    const btnCancelar = document.getElementById('btn-cancelar-edicao');

    if (formTitle) formTitle.innerText = 'Cadastrar Novo Celular';
    if (btnSalvar) btnSalvar.innerText = 'Salvar Celular';
    if (btnCancelar) btnCancelar.style.display = 'none';
}

async function adicionarProduto() {
    const idEdit = document.getElementById('prod-id-edicao');
    const id = idEdit ? idEdit.value : '';

    const nameInput = document.getElementById('new-prod-name');
    const priceInput = document.getElementById('new-prod-price');
    const selectCat = document.getElementById('new-prod-category');
    const urlInput = document.getElementById('new-prod-img');
    const linkMpInput = document.getElementById('new-prod-link-mp');
    const descInput = document.getElementById('new-prod-desc');

    const name = nameInput ? nameInput.value.trim() : '';
    const price = priceInput ? priceInput.value.trim() : '';
    const category = selectCat ? selectCat.value : 'seminovo';
    let rawImg = urlInput ? urlInput.value.trim() : '';
    const linkMP = linkMpInput ? linkMpInput.value.trim() : '';
    const desc = (descInput && descInput.value.trim()) ? descInput.value.trim() : 'Aparelho com garantia da loja R & D Imports.';

    if (!name || !price) {
        alert('Preencha pelo menos o Nome e o Preço do aparelho.');
        return;
    }

    const imgUrl = formatarUrlGoogleDrive(rawImg) || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600';

    const dadosProduto = { name, price, category, img: imgUrl, linkMP, desc };

    if (id) {
        db.collection('produtos').doc(id).update(dadosProduto).then(() => {
            alert('Produto atualizado com sucesso na nuvem!');
            limparFormularioAdmin();
            buscarProdutos();
        }).catch(err => alert("Erro ao atualizar produto: " + err.message));
    } else {
        db.collection('produtos').add({
            ...dadosProduto,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            alert('Produto cadastrado e sincronizado com sucesso na nuvem!');
            limparFormularioAdmin();
            buscarProdutos();
        }).catch(err => alert("Erro ao salvar produto: " + err.message));
    }
}

function atualizarProdutoRapido(id) {
    const inputPrice = document.getElementById(`edit-price-${id}`);
    const selectCategory = document.getElementById(`edit-cat-${id}`);

    if (inputPrice && selectCategory) {
        db.collection('produtos').doc(id).update({
            price: inputPrice.value.trim(),
            category: selectCategory.value
        }).then(() => {
            alert('Produto atualizado na nuvem com sucesso!');
            buscarProdutos();
        }).catch(err => alert("Erro ao atualizar: " + err.message));
    }
}

function removerProduto(id) {
    if (confirm(`Deseja remover este aparelho da vitrine?`)) {
        db.collection('produtos').doc(id).delete().then(() => {
            alert('Produto removido do banco de dados!');
            limparFormularioAdmin();
            buscarProdutos();
        }).catch(err => alert("Erro ao remover: " + err.message));
    }
}

// ============================================================
// 8. GESTÃO DE SERVIÇOS NO PAINEL ADMIN
// ============================================================
function renderAdminServicos() {
    const adminServList = document.getElementById('admin-servicos-list');
    if (!adminServList) return;
    adminServList.innerHTML = '';

    if (servicos.length === 0) {
        adminServList.innerHTML = '<p style="font-size: 13px; color: #6b7280; padding: 10px;">Nenhum serviço cadastrado.</p>';
        return;
    }

    servicos.forEach((s) => {
        const precoExibicao = formatarPrecoServico(s.price);
        adminServList.innerHTML += `
            <div class="admin-prod-row" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="flex-grow: 1; min-width: 200px;">
                    <div style="font-weight: 600; font-size: 14px; color: #111827;">${s.name}</div>
                    <div style="font-size: 12px; color: #6b7280;">Exibição: <strong style="color: #b45309;">${precoExibicao}</strong></div>
                </div>
                <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                    <button class="btn btn-outline" style="padding: 6px 10px; font-size: 12px;" onclick="preencherEdicaoServico('${s.id}')">
                        <i class="fa-solid fa-pen-to-square"></i> Editar
                    </button>
                    <input type="text" id="edit-serv-price-${s.id}" value="${s.price || ''}" class="form-control" style="width: 140px; padding: 5px; font-size: 12px;" placeholder="Ex: 150,00">
                    <button class="btn" style="padding: 6px 10px; font-size: 12px;" onclick="atualizarServicoRapido('${s.id}')">Salvar Rápido</button>
                    <button class="btn btn-outline" style="padding: 6px 10px; font-size: 12px; border-color: #dc2626; color: #dc2626;" onclick="removerServico('${s.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
}

function atualizarServicoRapido(id) {
    const inputPrice = document.getElementById(`edit-serv-price-${id}`);

    if (inputPrice) {
        db.collection('servicos').doc(id).update({
            price: inputPrice.value.trim()
        }).then(() => {
            alert('Valor do serviço atualizado com sucesso!');
            buscarServicos();
        }).catch(err => alert("Erro ao atualizar serviço: " + err.message));
    }
}

function preencherEdicaoServico(id) {
    const s = servicos.find(item => item.id === id);
    if (!s) return;

    const idEdit = document.getElementById('serv-id-edicao');
    const nameInput = document.getElementById('new-serv-name');
    const priceInput = document.getElementById('new-serv-price');
    const descInput = document.getElementById('new-serv-desc');

    if (idEdit) idEdit.value = s.id;
    if (nameInput) nameInput.value = s.name || '';
    if (priceInput) priceInput.value = s.price || '';
    if (descInput) descInput.value = s.desc || '';

    const formTitle = document.getElementById('form-titulo-serv');
    const btnSalvar = document.getElementById('btn-salvar-serv');
    const btnCancelar = document.getElementById('btn-cancelar-serv');

    if (formTitle) formTitle.innerText = 'Editar Serviço';
    if (btnSalvar) btnSalvar.innerText = 'Salvar Alterações';
    if (btnCancelar) btnCancelar.style.display = 'inline-block';

    // Rola suavemente até o formulário de serviços
    window.scrollTo({ top: (formTitle ? formTitle.offsetTop - 100 : 0), behavior: 'smooth' });
}

function limparFormularioServico() {
    const idEdit = document.getElementById('serv-id-edicao');
    const nameInput = document.getElementById('new-serv-name');
    const priceInput = document.getElementById('new-serv-price');
    const descInput = document.getElementById('new-serv-desc');

    if (idEdit) idEdit.value = '';
    if (nameInput) nameInput.value = '';
    if (priceInput) priceInput.value = '';
    if (descInput) descInput.value = '';

    const formTitle = document.getElementById('form-titulo-serv');
    const btnSalvar = document.getElementById('btn-salvar-serv');
    const btnCancelar = document.getElementById('btn-cancelar-serv');

    if (formTitle) formTitle.innerText = 'Cadastrar Novo Serviço';
    if (btnSalvar) btnSalvar.innerText = 'Salvar Serviço';
    if (btnCancelar) btnCancelar.style.display = 'none';
}

function salvarServico() {
    const idEdit = document.getElementById('serv-id-edicao');
    const id = idEdit ? idEdit.value : '';

    const nameInput = document.getElementById('new-serv-name');
    const priceInput = document.getElementById('new-serv-price');
    const descInput = document.getElementById('new-serv-desc');

    const name = nameInput ? nameInput.value.trim() : '';
    const price = priceInput ? priceInput.value.trim() : '';
    const desc = descInput ? descInput.value.trim() : '';

    if (!name || !price) {
        alert('Preencha pelo menos o Nome e o Valor do serviço.');
        return;
    }

    const dadosServico = { name, price, desc };

    if (id) {
        db.collection('servicos').doc(id).update(dadosServico).then(() => {
            alert('Serviço atualizado com sucesso!');
            limparFormularioServico();
            buscarServicos();
        }).catch(err => alert("Erro ao atualizar serviço: " + err.message));
    } else {
        db.collection('servicos').add({
            ...dadosServico,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            alert('Serviço cadastrado com sucesso!');
            limparFormularioServico();
            buscarServicos();
        }).catch(err => alert("Erro ao cadastrar serviço: " + err.message));
    }
}

function removerServico(id) {
    if (confirm('Deseja remover este serviço da lista?')) {
        db.collection('servicos').doc(id).delete().then(() => {
            alert('Serviço removido com sucesso!');
            limparFormularioServico();
            buscarServicos();
        }).catch(err => alert("Erro ao remover serviço: " + err.message));
    }
}

// ============================================================
// 9. AUTENTICAÇÃO E MODAIS (LOGIN / MERCADO PAGO / CONTATO)
// ============================================================
// 1. LOGIN COM FIREBASE AUTH
function fazerLogin(e) {
    if (e) e.preventDefault();

    const emailInput = document.getElementById('admin-email');
    const passInput = document.getElementById('admin-password');

    const email = emailInput ? emailInput.value.trim() : '';
    const pass = passInput ? passInput.value : '';

    if (!email || !pass) {
        alert('Por favor, preencha o e-mail e a palavra-passe.');
        return;
    }

    firebase.auth().signInWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            document.getElementById('admin-login-box').style.display = 'none';
            document.getElementById('admin-dashboard-box').style.display = 'block';
            if (typeof alternarModuloAdmin === 'function') {
                alternarModuloAdmin('produtos');
            }
        })
        .catch((error) => {
            console.error("Erro de autenticação:", error);
            alert("Acesso negado: E-mail ou palavra-passe incorretos.");
        });
}

// 2. ESCUTA DE SESSÃO DO FIREBASE (Mantém a sessão aberta)
firebase.auth().onAuthStateChanged((user) => {
    const loginBox = document.getElementById('admin-login-box');
    const dashboardBox = document.getElementById('admin-dashboard-box');

    if (user && loginBox && dashboardBox) {
        loginBox.style.display = 'none';
        dashboardBox.style.display = 'block';
    } else if (loginBox && dashboardBox) {
        loginBox.style.display = 'block';
        dashboardBox.style.display = 'none';
    }
});

// FUNÇÃO DE LOGOUT DO ADMINISTRADOR
function fazerLogout() {
    firebase.auth().signOut()
        .then(() => {
            // Opcional: recarrega a página para limpar o estado e voltar ao login
            window.location.reload();
        })
        .catch((error) => {
            console.error("Erro ao encerrar sessão:", error);
            alert("Erro ao sair do painel.");
        });
}

function abrirModalMP(produto, preco, linkMP) {
    const modalTitle = document.getElementById('mp-modal-title');
    const modalPrice = document.getElementById('mp-modal-price');
    const modal = document.getElementById('mp-modal');

    if (modalTitle) modalTitle.innerText = produto;
    if (modalPrice) modalPrice.innerText = preco.startsWith('R$') ? preco : `R$ ${preco}`;

    linkMPAtual = linkMP || "https://link.mercadopago.com.br/poian";

    if (modal) modal.style.display = 'flex';
}

function fecharModalMP() {
    const modal = document.getElementById('mp-modal');
    if (modal) modal.style.display = 'none';
}

function finalizarPagamentoMP() {
    const url = linkMPAtual || "https://link.mercadopago.com.br/poian";
    window.open(url, '_blank');
    fecharModalMP();
}

// ENVIO DE MENSAGEM DO FORMULÁRIO PARA O WHATSAPP
function enviarMensagem(e) {
    if (e) e.preventDefault();

    const form = e ? (e.target.tagName === 'FORM' ? e.target : e.target.closest('form')) : null;

    // 1. Tenta capturar o Nome dentro do formulário ou por ID
    let elNome = form ? form.querySelector('input[type="text"]:not([placeholder*="Telefone"])') : null;
    if (!elNome) elNome = document.getElementById('nome') || document.getElementById('contact-name') || document.querySelector('.contact-form input[type="text"]');
    const nome = elNome ? elNome.value.trim() : '';

    // 2. Tenta capturar o Telefone
    let elTel = form ? form.querySelector('input[placeholder*="Telefone"], input[type="tel"]') : null;
    if (!elTel) elTel = document.getElementById('telefone') || document.getElementById('contact-phone');
    const telefone = elTel ? elTel.value.trim() : '';

    // 3. Tenta capturar a Mensagem / Caixa de texto (textarea ou input)
    let elMsg = form ? form.querySelector('textarea') : null;
    if (!elMsg) elMsg = document.getElementById('mensagem') || document.getElementById('contact-message') || document.querySelector('.contact-form textarea');
    const mensagem = elMsg ? elMsg.value.trim() : '';

    // Validação de preenchimento
    if (!nome || !mensagem) {
        alert('Por favor, preencha o seu nome e a mensagem.');
        return;
    }

    // 4. Monta o texto formatado para envio no WhatsApp
    let textoWhatsApp = `Olá! Meu nome é *${nome}*.\n`;
    if (telefone) textoWhatsApp += `*Telefone/Whats:* ${telefone}\n`;
    textoWhatsApp += `*Consulta:* ${mensagem}`;

    // 5. Número do WhatsApp da loja
    const numeroLoja = "5554981166189";

    // 6. Abre o WhatsApp com a mensagem pré-preenchida
    const url = `https://api.whatsapp.com/send?phone=${numeroLoja}&text=${encodeURIComponent(textoWhatsApp)}`;
    window.open(url, '_blank');

    // Limpa os campos do formulário
    if (form) form.reset();
}

// ============================================================
// 10. MENU HAMBÚRGUER NO MOBILE
// ============================================================
// Função responsável por abrir/fechar o menu suspenso em telas de smartphone
function toggleMenu() {
    const navList = document.getElementById('nav-list');
    const menuBtn = document.getElementById('menu-toggle');

    if (navList) {
        navList.classList.toggle('active');
    }

    // Alterna o ícone entre os 3 traços (☰) e o X de fechar (✕)
    if (menuBtn) {
        const icon = menuBtn.querySelector('i');
        if (icon) {
            if (navList.classList.contains('active')) {
                icon.className = 'fa-solid fa-xmark';
            } else {
                icon.className = 'fa-solid fa-bars';
            }
        }
    }
}