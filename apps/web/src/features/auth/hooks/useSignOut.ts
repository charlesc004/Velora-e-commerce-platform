import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppDispatch } from '@/app/store';
import { baseApi } from '@/lib/api/baseApi';
import { errorMessage } from '@/lib/utils/errors';
import { useLogoutMutation } from '../api/auth.api';

export function useSignOut() {
  const [logout, { isLoading }] = useLogoutMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  async function signOut(): Promise<void> {
    try {
      await logout().unwrap();
      dispatch(baseApi.util.resetApiState());
      navigate('/login');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return { signOut, isLoading };
}
