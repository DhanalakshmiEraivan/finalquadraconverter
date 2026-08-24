import { useRouter } from '@/router';
import { useAuth } from '@/lib/auth';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AIFeaturePage } from '@/pages/AIFeaturePage';
import { aiFeatures } from '@/data/tools';
import { LandingPage } from '@/pages/LandingPage';
import { ToolsPage } from '@/pages/ToolsPage';
import { ToolWorkspace } from '@/pages/ToolWorkspace';
import { DashboardPage } from '@/pages/DashboardPage';
import { PricingPage } from '@/pages/PricingPage';
import { AdminPage } from '@/pages/AdminPage';
import { AuthPage } from '@/pages/AuthPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { FeaturesPage } from '@/pages/FeaturesPage';
import { AboutPage } from '@/pages/AboutPage';
import { ContactPage } from '@/pages/ContactPage';
import { SecurityPage } from '@/pages/SecurityPage';
import { SignaturesPage } from '@/pages/SignaturesPage';
import { PublicSigningPage } from '@/pages/PublicSigningPage';

import { getToolById } from '@/data/tools';

import { Loader2 } from 'lucide-react';

function App() {
  const { route, navigate } = useRouter();

  const {
    user,
    role,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const isAdminRoute =
    route.name === 'admin';

  const isResetRoute =
    route.name === 'reset-password';

  const isAuthRoute =
    route.name === 'auth';

  const isPublicSigningRoute =
    route.name === 'sign';

  /*
   * NEVER redirect a password recovery session away
   * from the reset-password page.
   */
  if (isResetRoute) {
    return (
      <ResetPasswordPage
        navigate={navigate}
      />
    );
  }

  /*
   * Protected routes.
   */
  if (
    (
      route.name === 'dashboard' ||
      route.name === 'admin' ||
      route.name === 'tool'
    ) &&
    !user &&
    !isPublicSigningRoute
  ) {
    return <AuthPage />;
  }

  /*
   * Admin protection.
   */
  if (
    route.name === 'admin' &&
    role !== 'admin'
  ) {
    return (
      <DashboardPage
        navigate={navigate}
      />
    );
  }

  /*
   * Only redirect normal authenticated users.
   * Password recovery is handled above.
   */
  if (isAuthRoute && user) {
    return role === 'admin'
      ? <AdminPage navigate={navigate} />
      : <DashboardPage navigate={navigate} />;
  }

  if (isPublicSigningRoute) {
    return <PublicSigningPage />;
  }

  return (
    <div className="app-shell">

      {!isAuthRoute &&
        !isAdminRoute && (
          <Header
            route={route}
            navigate={navigate}
          />
        )}

      <main className="flex-1 min-w-0">
        {route.name === 'ai' && (() => {
  const feature = aiFeatures.find(
    (item) => item.id === route.id
  );

  if (!feature) {
    return <NotFound navigate={navigate} />;
  }

  return (
    <AIFeaturePage
      feature={feature}
      navigate={navigate}
    />
  );
})()}

        {route.name === 'auth' && (
          <AuthPage />
        )}

        {route.name === 'home' && (
          <LandingPage
            navigate={navigate}
          />
        )}

        {route.name === 'tools' && (
          <ToolsPage
            navigate={navigate}
            category={route.category}
          />
        )}

        {route.name === 'tool' &&
          user &&
          (() => {
            const tool = getToolById(
              route.id
            );

            if (!tool) {
              return (
                <NotFound
                  navigate={navigate}
                />
              );
            }

            return (
              <ToolWorkspace
                tool={tool}
                navigate={navigate}
              />
            );
          })()}

        {route.name === 'dashboard' &&
          user && (
            <DashboardPage
              navigate={navigate}
            />
          )}

        {route.name === 'pricing' && (
          <PricingPage
            navigate={navigate}
          />
        )}

        {route.name === 'features' && (
          <FeaturesPage />
        )}

        {route.name === 'about' && (
          <AboutPage />
        )}

        {route.name === 'contact' && (
          <ContactPage />
        )}

        {route.name === 'security' && (
          <SecurityPage />
        )}

        {route.name === 'signatures' && (
          <SignaturesPage
            navigate={navigate}
          />
        )}

        {route.name === 'admin' &&
          role === 'admin' && (
            <AdminPage
              navigate={navigate}
            />
          )}

      </main>

      {!isAuthRoute &&
        !isAdminRoute && (
          <Footer
            navigate={navigate}
          />
        )}
    </div>
  );
}

function NotFound({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  return (
    <div className="container-page py-24 text-center">

      <p className="font-display text-6xl font-extrabold text-ink-200">
        404
      </p>

      <h1 className="mt-4 font-display text-2xl font-bold text-ink-900">
        Page not found
      </h1>

      <p className="mt-2 text-ink-500">
        The tool or page you are looking for does not exist.
      </p>

      <button
        onClick={() => navigate('/')}
        className="btn-primary mt-6"
      >
        Back to home
      </button>
    </div>
  );
}

export default App;
