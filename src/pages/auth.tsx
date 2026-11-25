import { AuthHero } from "../components/auth-hero";
import { Icon } from "../components/icon";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Turnstile, type TurnstileHandle } from "../components/turnstile";
import { Brand } from "../brand";
import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { authConfig, supabase } from "../lib/supabase";
import { api } from "../lib/api";
import type { Me } from "../../shared/types";
import { ErrorNotice, SuccessNotice, errorMessage } from "../ui";

// Turn Supabase auth failures into short Turkish copy the person can act on.
function authErrorMessage(error: { code?: string; message: string }, signup: boolean) {
  const text = `${error.code ?? ""} ${error.message}`.toLowerCase();
  if (text.includes("invitation")) return "Davet kodu geçersiz, kullanılmış veya süresi dolmuş. Yeni bir kodla tekrar dene.";
  if (text.includes("email_not_confirmed") || text.includes("email not confirmed")) return "E-postan henüz doğrulanmadı. Gelen kutundaki doğrulama bağlantısını aç.";
  if (text.includes("invalid_credentials") || text.includes("invalid login")) return "E-posta veya şifre hatalı.";
  if (text.includes("weak_password") || text.includes("password should be")) return "Şifre çok zayıf. En az 8 karakter kullan.";
  if (text.includes("already registered") || text.includes("user_already_exists")) return "Bu e-posta ile bir hesap zaten var. Giriş yapmayı dene.";
  if (text.includes("rate limit") || text.includes("rate_limit") || text.includes("too many")) return "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.";
  if (text.includes("captcha")) return "Güvenlik doğrulaması başarısız. Kutuyu yenileyip tekrar dene.";
  return signup ? "Kayıt tamamlanamadı. Davet kodunu ve bilgilerini kontrol et." : "Giriş yapılamadı. E-posta ve şifreni kontrol et.";
}

export function AuthPage({ signup = false }: { signup?: boolean }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState(""), [captchaToken, setCaptchaToken] = useState("");
  const turnstile = useRef<TurnstileHandle>(null);
  const inviteInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const siteKey = authConfig.turnstileSiteKey;
  // Keep the e-mail so a retry is one field away; clear the password and the spent invite.
  function clearSecrets() {
    if (inviteInput.current) inviteInput.current.value = "";
    if (passwordInput.current) passwordInput.current.value = "";
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setError(""); setMessage("");
    if (siteKey && !captchaToken) { setError("Devam etmek için güvenlik doğrulamasını tamamla."); return; }
    setBusy(true);
    try {
      const credentials = { email: String(data.get("email")), password: String(data.get("password")) };
      const result = signup
        ? await supabase.auth.signUp({ ...credentials, options: { emailRedirectTo: `${location.origin}/auth/confirm`, data: { invite_code: String(data.get("invite")).trim() }, ...(captchaToken ? { captchaToken } : {}) } })
        : await supabase.auth.signInWithPassword({ ...credentials, options: captchaToken ? { captchaToken } : undefined });
      if (result.error) throw new Error(authErrorMessage(result.error, signup));
      if (signup && !result.data.session) { clearSecrets(); setMessage("Kaydını tamamlamak için e-postana gelen doğrulama bağlantısını aç."); }
      else if (signup) await navigate({ to: "/onboarding", replace: true });
      else {
        // Signing in should land where the account is: unfinished profiles finish
        // onboarding first instead of flashing the feed.
        const me = await api<Me>("/me").catch(() => null);
        await navigate({ to: me && !me.profile.onboarded ? "/onboarding" : "/", replace: true });
      }
    } catch (e) {
      clearSecrets();
      // Turnstile tokens are single-use; a failed attempt needs a fresh challenge.
      setCaptchaToken(""); turnstile.current?.reset();
      setError(errorMessage(e));
    } finally { setBusy(false); }
  }
  return <main className="auth-layout">
    <div className="auth-intro">
      <Brand />
      <h1>Birlikte daha<br />fazla şey <span className="auth-accent">paylaş.</span></h1>
      <p className="muted auth-lead">İnsanlarla tanış, topluluklara katıl ve sohbeti başlat.</p>
      <ul className="auth-points">
        <li><Icon name="community" size={18} />Topluluklar</li>
        <li><Icon name="reply" size={18} />Sohbetler</li>
        <li><Icon name="job" size={18} />İlanlar</li>
        <li><Icon name="article" size={18} />Makaleler</li>
      </ul>
      <AuthHero />
    </div>
    <section className="panel auth-card"><p className="eyebrow">{signup ? "DAVETLİSİN" : "TEKRAR MERHABA"}</p><h2>{signup ? "Hesabını oluştur" : "Giriş yap"}</h2>
      <p className="muted">{signup ? "social-web'e yalnızca geçerli bir davet koduyla katılabilirsin." : "Sohbet kaldığı yerden devam ediyor."}</p>
      <form className="stack" onSubmit={submit}>
        {signup && <label><span>Davet kodu</span><Input ref={inviteInput} name="invite" required minLength={24} maxLength={128} autoComplete="off" spellCheck={false} /></label>}
        <label><span>E-posta</span><Input name="email" type="email" required autoComplete="email" /></label>
        <label><span>Şifre</span><Input ref={passwordInput} name="password" type="password" required minLength={8} autoComplete={signup ? "new-password" : "current-password"} /></label>
        {siteKey && <div className="turnstile-slot"><Turnstile ref={turnstile} siteKey={siteKey} onToken={setCaptchaToken} onError={setError} action={signup ? "signup" : "login"} /></div>}
        <Button className="bg-primary-500" aria-busy={busy} disabled={busy || (!!siteKey && !captchaToken)}>{busy ? <><span className="button-spinner" aria-hidden="true" /><span className="sr-only">Gönderiliyor</span></> : siteKey && !captchaToken ? "Doğrulama bekleniyor…" : signup ? "Davetle katıl" : "Giriş yap"}</Button>
        <ErrorNotice message={error} /><SuccessNotice message={message} />
      </form>
      <div className="auth-switch"><span>{signup ? "Zaten hesabın var mı?" : "Davet kodun mu var?"}</span><Link to={signup ? "/sign-in" : "/sign-up"}>{signup ? "Giriş yap" : "Davetle katıl"}</Link></div>
    </section>
  </main>;
}
export function ConfirmPage() { return <main className="page-state"><p>Hesabın doğrulanıyor…</p></main>; }
