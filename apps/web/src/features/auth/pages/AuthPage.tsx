import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
  type User,
} from '@velora/contracts';
import { ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { useLoginMutation, useRegisterMutation } from '../api/auth.api';
import { useMergeCartMutation } from '@/features/cart/api/cart.api';
import { guestCartActions } from '@/features/cart/cart.slice';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { errorMessage } from '@/lib/utils/errors';
import { usePageMeta } from '@/hooks/usePageMeta';
function useCompleteAuth(): (user: User) => Promise<void> {
  const items = useAppSelector((s) => s.guestCart.items);
  const dispatch = useAppDispatch();
  const [merge] = useMergeCartMutation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return async (user) => {
    if (items.length) {
      try {
        await merge({
          items: items.map(({ productId, variantId, quantity }) => ({
            productId,
            variantId,
            quantity,
          })),
        }).unwrap();
        dispatch(guestCartActions.clear());
      } catch (error) {
        toast.error(`Your saved bag needs attention: ${errorMessage(error)}`);
      }
    }
    const redirect = params.get('redirect');
    navigate(
      redirect?.startsWith('/') && !redirect.startsWith('//')
        ? redirect
        : user.role === 'admin'
          ? '/admin'
          : '/account',
      { replace: true },
    );
  };
}
function LoginForm(): React.JSX.Element {
  const [login, state] = useLoginMutation();
  const complete = useCompleteAuth();
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  return (
    <form
      className="form-stack"
      onSubmit={handleSubmit(async (input) => {
        try {
          const user = await login(input).unwrap();
          await complete(user);
        } catch (error) {
          setError('root', { message: errorMessage(error) });
        }
      })}
    >
      <Field label="Email address" error={errors.email?.message}>
        <Input type="email" autoComplete="email" {...register('email')} />
      </Field>
      <Field label="Password" error={errors.password?.message}>
        <Input type="password" autoComplete="current-password" {...register('password')} />
      </Field>
      {errors.root && (
        <p className="inline-error" role="alert">
          {errors.root.message}
        </p>
      )}
      <Button type="submit" disabled={state.isLoading}>
        {state.isLoading ? 'Signing you in…' : 'Sign in'}
        <ArrowUpRight size={16} />
      </Button>
    </form>
  );
}
function RegisterForm(): React.JSX.Element {
  const [create, state] = useRegisterMutation();
  const complete = useCompleteAuth();
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });
  return (
    <form
      className="form-stack"
      onSubmit={handleSubmit(async (input) => {
        try {
          const user = await create(input).unwrap();
          await complete(user);
        } catch (error) {
          setError('root', { message: errorMessage(error) });
        }
      })}
    >
      <Field label="Full name" error={errors.name?.message}>
        <Input autoComplete="name" {...register('name')} />
      </Field>
      <Field label="Email address" error={errors.email?.message}>
        <Input type="email" autoComplete="email" {...register('email')} />
      </Field>
      <Field label="Password" error={errors.password?.message}>
        <Input type="password" autoComplete="new-password" {...register('password')} />
      </Field>
      <p className="field-hint">At least 10 characters, with an uppercase letter and a number.</p>
      {errors.root && (
        <p className="inline-error" role="alert">
          {errors.root.message}
        </p>
      )}
      <Button type="submit" disabled={state.isLoading}>
        {state.isLoading ? 'Making room for you…' : 'Create account'}
        <ArrowUpRight size={16} />
      </Button>
      <p className="checkout-terms">
        By creating an account, you agree to our <Link to="/information/terms">Terms</Link> and{' '}
        <Link to="/information/privacy">Privacy Policy</Link>.
      </p>
    </form>
  );
}
export default function AuthPage({
  mode = 'login',
}: {
  mode?: 'login' | 'register';
}): React.JSX.Element {
  const [params] = useSearchParams();
  const registering = mode === 'register';
  usePageMeta(registering ? 'Join VELORA' : 'Welcome back');
  const query = params.toString() ? `?${params.toString()}` : '';
  return (
    <div className="auth-page">
      <div className="auth-image">
        <img
          src="/images/editorial.jpg"
          alt="Softly lit natural fabrics in the VELORA atelier"
          width="900"
          height="1200"
        />
        <div>
          <p className="eyebrow">THE ART OF EVERYDAY</p>
          <h2>
            A little more
            <br />
            you.
          </h2>
        </div>
      </div>
      <div className="auth-content">
        <p className="eyebrow">YOUR WORLD OF VELORA</p>
        <h1>{registering ? 'Make yourself at home.' : 'Good to see you again.'}</h1>
        <p className="muted">
          {registering
            ? 'Your favorites, your orders, your own point of view.'
            : 'A familiar place for your favorite pieces.'}
        </p>
        {registering ? <RegisterForm /> : <LoginForm />}
        <p className="auth-switch">
          {registering ? 'Already part of VELORA?' : 'New around here?'}{' '}
          <Link to={`${registering ? '/login' : '/register'}${query}`}>
            {registering ? 'Sign in' : 'Create an account'} <ArrowUpRight size={13} />
          </Link>
        </p>
      </div>
    </div>
  );
}
