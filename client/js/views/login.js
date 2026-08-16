import { api } from '../api.js';
import { avatarHtml, escapeHtml, toast } from '../components.js';
import { setSession, loadAllUsers, state } from '../state.js';

export async function renderLogin(root, onLoggedIn) {
  root.innerHTML = `<div class="login-screen"><p class="muted">carregando...</p></div>`;
  let users = [];
  try { users = (await api.get('/users')).users; } catch (e) { /* backend pode estar de boot */ }

  function showPicker() {
    root.innerHTML = `
      <div class="login-screen">
        <div class="display">📖 BBB</div>
        <p class="muted">um diário de leitura para vocês duas</p>
        <div class="profile-picker" id="picker">
          ${users.map((u) => `
            <div class="profile-card" data-username="${escapeHtml(u.username)}">
              ${avatarHtml(u, 64)}
              <div style="font-weight:800">${escapeHtml(u.name)}</div>
              <div class="muted" style="font-size:0.78rem">@${escapeHtml(u.username)}</div>
            </div>`).join('')}
          <div class="profile-card" id="add-new">
            <div class="avatar" style="width:64px;height:64px;background:#ECE1F0;color:#6B4E71;font-size:1.6rem">+</div>
            <div style="font-weight:800">Nova usuária</div>
            <div class="muted" style="font-size:0.78rem">adicionar amiga</div>
          </div>
        </div>
      </div>`;
    root.querySelectorAll('.profile-card[data-username]').forEach((card) => {
      card.onclick = () => showLoginForm(card.dataset.username);
    });
    root.querySelector('#add-new').onclick = () => showRegisterForm();
  }

  function showLoginForm(username) {
    const user = users.find((u) => u.username === username);
    root.innerHTML = `
      <div class="login-screen">
        <div class="display">Olá, ${escapeHtml(user.name)} 👋</div>
        <form class="auth-form" id="login-form">
          <div class="field"><label>Senha</label><input type="password" id="f-password" autofocus /></div>
          <button class="btn btn-primary btn-block" type="submit">Entrar</button>
        </form>
        <button class="link-btn" id="back" style="margin-top:14px">← escolher outra usuária</button>
      </div>`;
    root.querySelector('#back').onclick = showPicker;
    root.querySelector('#login-form').onsubmit = async (e) => {
      e.preventDefault();
      const password = root.querySelector('#f-password').value;
      try {
        const { token, user: u } = await api.post('/auth/login', { username, password });
        setSession(token, u);
        await loadAllUsers();
        onLoggedIn();
      } catch (err) {
        toast(err.message);
      }
    };
  }

  function showRegisterForm() {
    root.innerHTML = `
      <div class="login-screen">
        <div class="display">Criar perfil ✨</div>
        <p class="muted">para você ou para a amiga que vai dividir as leituras</p>
        <form class="auth-form" id="reg-form">
          <div class="field"><label>Nome</label><input id="f-name" required /></div>
          <div class="field"><label>@usuário</label><input id="f-username" required /></div>
          <div class="field"><label>Senha</label><input type="password" id="f-password" required /></div>
          <div class="field"><label>Bio (opcional)</label><input id="f-bio" placeholder="uma frase sobre você e livros" /></div>
          <button class="btn btn-primary btn-block" type="submit">Criar perfil</button>
        </form>
        <button class="link-btn" id="back" style="margin-top:14px">${users.length ? '← voltar' : ''}</button>
      </div>`;
    root.querySelector('#back').onclick = () => (users.length ? showPicker() : showRegisterForm());
    root.querySelector('#reg-form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const { token, user: u } = await api.post('/auth/register', {
          name: root.querySelector('#f-name').value.trim(),
          username: root.querySelector('#f-username').value.trim(),
          password: root.querySelector('#f-password').value,
          bio: root.querySelector('#f-bio').value.trim(),
        });
        setSession(token, u);
        await loadAllUsers();
        onLoggedIn();
      } catch (err) {
        toast(err.message);
      }
    };
  }

  if (users.length === 0) showRegisterForm();
  else showPicker();
}
