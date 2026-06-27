<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <h1>Mindx</h1>
        <p>免费思维导图工具</p>
      </div>

      <!-- 注册成功 - 显示恢复码 -->
      <div v-if="recoveryKey" class="recovery-panel">
        <div class="recovery-icon">🔑</div>
        <h3>注册成功！请保存恢复码</h3>
        <div class="recovery-code">{{ recoveryKey }}</div>
        <p class="recovery-hint">忘记密码时可使用此恢复码重置密码，请妥善保管</p>
        <button class="submit-btn" @click="copyAndContinue">复制并进入</button>
      </div>

      <!-- 登录/注册/重置密码 表单 -->
      <template v-else>
        <div class="tab-bar">
          <button :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</button>
          <button :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</button>
        </div>

        <form @submit.prevent="handleSubmit" class="login-form">
          <div class="form-group">
            <label>用户名</label>
            <input
              v-model="username"
              type="text"
              placeholder="2-20 个字符"
              autocomplete="username"
              required
            />
          </div>
          <div v-if="mode === 'reset'" class="form-group">
            <label>恢复码</label>
            <input
              v-model="recoveryKeyInput"
              type="text"
              placeholder="输入注册时获得的恢复码"
              required
            />
          </div>
          <div class="form-group">
            <label>{{ mode === 'reset' ? '新密码' : '密码' }}</label>
            <input
              v-model="password"
              type="password"
              :placeholder="mode === 'reset' ? '输入新密码，至少 6 个字符' : '至少 6 个字符'"
              autocomplete="current-password"
              required
            />
          </div>
          <div v-if="error" class="error-msg">{{ error }}</div>
          <div v-if="success" class="success-msg">{{ success }}</div>

          <!-- 用户协议（仅注册时显示） -->
          <div v-if="mode === 'register'" class="agreement-box">
            <label class="agreement-label">
              <input type="checkbox" v-model="agreed" />
              <span>我已阅读并同意</span>
            </label>
            <a href="#" @click.prevent="showAgreement = true" class="agreement-link">《用户服务协议》</a>
          </div>

          <button type="submit" class="submit-btn" :disabled="loading || (mode === 'register' && !agreed)">
            {{ loading ? '处理中...' : { login: '登录', register: '注册', reset: '重置密码' }[mode] }}
          </button>
        </form>

        <div class="form-footer">
          <a v-if="mode === 'login'" href="#" @click.prevent="mode = 'reset'">忘记密码？</a>
          <a v-if="mode === 'reset'" href="#" @click.prevent="mode = 'login'">返回登录</a>
        </div>
      </template>

      <!-- 用户协议弹窗 -->
      <div v-if="showAgreement" class="agreement-modal" @click.self="showAgreement = false">
        <div class="agreement-content">
          <h3>Mindx 用户服务协议</h3>
          <div class="agreement-text">
            <p><strong>欢迎您使用 Mindx！</strong></p>
            <p>在使用本服务之前，请您仔细阅读并充分理解以下条款。注册或使用本服务即视为您已同意本协议的全部内容。</p>

            <h4>一、服务说明</h4>
            <p>Mindx 是一款免费的在线思维导图工具，仅供<strong>学习和个人使用</strong>，不得用于任何商业用途。本服务按"现状"提供，我们不对服务的持续性、安全性或准确性作任何明示或暗示的保证。</p>

            <h4>二、用户账号</h4>
            <p>1. 注册时系统将自动生成一个<strong>恢复码</strong>，该恢复码仅在注册时显示一次，用于密码找回，请务必妥善保管。</p>
            <p>2. 您的密码经过加密存储，我们无法获取您的原始密码。如忘记密码且未保存恢复码，将无法找回账号。</p>
            <p>3. 您应妥善保管账号信息，因账号泄露导致的任何损失由您自行承担。</p>

            <h4>三、数据存储与安全</h4>
            <p>1. 您创建的思维导图数据存储在服务器端，我们采取合理措施保护数据安全，但无法保证数据的绝对安全。</p>
            <p>2. <strong>建议您定期导出并本地备份重要的思维导图数据。</strong>因服务器故障、系统升级、不可抗力等原因导致的数据丢失，本平台不承担责任。</p>
            <p>3. 我们不会主动查看、修改或删除您的思维导图内容，但有权在必要时对违规内容进行处理。</p>

            <h4>四、用户行为规范</h4>
            <p>1. 您不得利用本服务存储、传播违反法律法规的内容。</p>
            <p>2. 您不得对本服务进行反向工程、破解或试图获取源代码。</p>
            <p>3. 您不得利用本服务从事任何可能损害他人权益的行为。</p>

            <h4>五、免责条款</h4>
            <p>1. 本服务仅供学习和个人使用，使用者应自行承担使用风险。</p>
            <p>2. 因网络状况、通信线路、第三方服务等原因导致的服务中断或数据丢失，本平台不承担责任。</p>
            <p>3. 因用户自身操作不当（包括但不限于误删数据、泄露密码和恢复码）导致的任何损失，本平台不承担责任。</p>
            <p>4. 对于任何因使用或无法使用本服务而产生的间接、附带、特殊或后果性损害，本平台不承担责任。</p>

            <h4>六、协议修改</h4>
            <p>我们保留随时修改本协议的权利，修改后的协议将在网站上公布。继续使用本服务即视为您接受修改后的协议。</p>

            <p class="agreement-date">本协议最后更新日期：2026 年 6 月 27 日</p>
          </div>
          <button class="submit-btn" @click="showAgreement = false">我已知悉，关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const router = useRouter()
const authStore = useAuthStore()

const mode = ref('login')
const username = ref('')
const password = ref('')
const recoveryKeyInput = ref('')
const recoveryKey = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)
const agreed = ref(false)
const showAgreement = ref(false)

async function handleSubmit() {
  error.value = ''
  success.value = ''
  loading.value = true
  try {
    if (mode.value === 'login') {
      await authStore.login(username.value, password.value)
      router.push('/')
    } else if (mode.value === 'register') {
      const data = await authStore.register(username.value, password.value)
      if (data.recovery_key) {
        recoveryKey.value = data.recovery_key
      } else {
        router.push('/')
      }
    } else if (mode.value === 'reset') {
      await authStore.resetPassword(username.value, recoveryKeyInput.value, password.value)
      success.value = '密码重置成功！请使用新密码登录'
      mode.value = 'login'
      password.value = ''
      recoveryKeyInput.value = ''
    }
  } catch (e) {
    error.value = e.response?.data?.error || '操作失败'
  } finally {
    loading.value = false
  }
}

function copyAndContinue() {
  navigator.clipboard.writeText(recoveryKey.value).catch(() => {})
  router.push('/')
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.login-card {
  background: #fff;
  border-radius: 16px;
  padding: 40px;
  width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}
.login-header {
  text-align: center;
  margin-bottom: 32px;
}
.login-header h1 {
  font-size: 28px;
  color: #1a1a2e;
  margin: 0 0 8px;
  font-weight: 700;
}
.login-header p {
  color: #666;
  margin: 0;
  font-size: 14px;
}
.tab-bar {
  display: flex;
  gap: 0;
  margin-bottom: 24px;
  background: #f1f5f9;
  border-radius: 10px;
  padding: 4px;
}
.tab-bar button {
  flex: 1;
  padding: 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  border-radius: 8px;
  transition: all 0.2s;
}
.tab-bar button.active {
  background: #fff;
  color: #4f46e5;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}
.form-group input {
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.form-group input:focus {
  border-color: #4f46e5;
}
.error-msg {
  color: #ef4444;
  font-size: 13px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #fef2f2;
  border-radius: 8px;
}
.success-msg {
  color: #10b981;
  font-size: 13px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #ecfdf5;
  border-radius: 8px;
}
.submit-btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.submit-btn:hover {
  opacity: 0.9;
}
.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.form-footer {
  text-align: center;
  margin-top: 16px;
}
.form-footer a {
  color: #4f46e5;
  font-size: 13px;
  text-decoration: none;
}
.form-footer a:hover {
  text-decoration: underline;
}
.recovery-panel {
  text-align: center;
}
.recovery-icon {
  font-size: 48px;
  margin-bottom: 16px;
}
.recovery-panel h3 {
  color: #1a1a2e;
  margin: 0 0 16px;
  font-size: 18px;
}
.recovery-code {
  background: #f1f5f9;
  border: 2px dashed #c7d2fe;
  border-radius: 12px;
  padding: 16px;
  font-size: 24px;
  font-weight: 700;
  color: #4f46e5;
  letter-spacing: 4px;
  margin-bottom: 12px;
  font-family: 'Courier New', monospace;
}
.recovery-hint {
  color: #ef4444;
  font-size: 13px;
  margin-bottom: 20px;
  line-height: 1.5;
}
.agreement-box {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 16px;
  font-size: 13px;
}
.agreement-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: #475569;
}
.agreement-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #4f46e5;
  cursor: pointer;
}
.agreement-link {
  color: #4f46e5;
  text-decoration: none;
  font-size: 13px;
}
.agreement-link:hover {
  text-decoration: underline;
}
.agreement-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}
.agreement-content {
  background: #fff;
  border-radius: 16px;
  padding: 32px;
  width: 520px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}
.agreement-content h3 {
  text-align: center;
  font-size: 20px;
  color: #1a1a2e;
  margin: 0 0 20px;
}
.agreement-text {
  flex: 1;
  overflow-y: auto;
  font-size: 13px;
  color: #374151;
  line-height: 1.8;
  padding-right: 8px;
}
.agreement-text h4 {
  font-size: 14px;
  color: #1a1a2e;
  margin: 16px 0 8px;
}
.agreement-text p {
  margin: 0 0 8px;
}
.agreement-date {
  text-align: right;
  color: #94a3b8;
  font-size: 12px;
  margin-top: 16px;
}
</style>
