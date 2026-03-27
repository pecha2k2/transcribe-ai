'use client';

import Hero from '@/components/Hero';
import AuthForm from '@/components/AuthForm';
import Dashboard from '@/components/Dashboard';
import StepperWizard from '@/components/StepperWizard';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/hooks/useAuthStore';

function HomeContent() {
  const { user } = useAuth();
  const { currentView } = useAuthStore();

  if (!user) {
  return (
    <main className="min-h-screen flex flex-col">
      <Hero />
      <AuthForm />
    </main>
  );
  }

  if (currentView === 'wizard') {
    return <StepperWizard />;
  }

  return <Dashboard />;
}

export default function Home() {
  return (
    <AuthProvider>
      <HomeContent />
    </AuthProvider>
  );
}
