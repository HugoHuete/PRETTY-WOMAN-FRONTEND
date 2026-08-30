import { LoginPage } from './features/auth/login-page';
import { AuthProvider } from './features/auth/auth-provider';

function App() {
  return (
    <AuthProvider>
      <LoginPage />
    </AuthProvider>
  );
}

export default App;
