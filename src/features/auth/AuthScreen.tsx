import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Button, ErrorNote, Field, TextInput } from '../../components/ui';
import { api } from '../../lib/api';
import { keys } from '../../lib/queries';

export function AuthScreen() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const submit = useMutation({
    mutationFn: () =>
      mode === 'login' ? api.login(email, password) : api.register({ email, password, name, inviteCode }),
    onSuccess: (session) => qc.setQueryData(keys.session, session),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit.mutate();
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    submit.reset();
  };

  return (
    <div className="fullscreen-center">
      <form className="auth" onSubmit={onSubmit} noValidate>
        <img className="auth-mark" src="/icon.svg" alt="" />
        <h1>{mode === 'login' ? '登入' : '建立帳號'}</h1>
        <p className="auth-sub">{mode === 'login' ? '記錄每日飲食與營養攝取' : '需要邀請碼才能註冊'}</p>

        {mode === 'register' && (
          <Field label="名稱" htmlFor="name">
            <TextInput id="name" autoComplete="nickname" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
        )}
        <Field label="Email" htmlFor="email">
          <TextInput
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="密碼" htmlFor="password" hint={mode === 'register' ? '至少 8 個字元' : undefined}>
          <TextInput
            id="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {mode === 'register' && (
          <Field label="邀請碼" htmlFor="invite">
            <TextInput
              id="invite"
              autoComplete="off"
              autoCapitalize="off"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          </Field>
        )}

        <div className="stack" style={{ marginTop: 24 }}>
          <ErrorNote error={submit.error} />
          <Button type="submit" variant="primary" block loading={submit.isPending}>
            {mode === 'login' ? '登入' : '建立帳號'}
          </Button>
        </div>

        <p className="auth-switch">
          {mode === 'login' ? '還沒有帳號？' : '已經有帳號？'}{' '}
          <button type="button" className="link-btn" onClick={switchMode}>
            {mode === 'login' ? '註冊' : '登入'}
          </button>
        </p>
      </form>
    </div>
  );
}
