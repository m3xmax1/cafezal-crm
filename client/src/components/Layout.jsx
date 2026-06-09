import { useAuth } from '../context/AuthContext.jsx';

export default function Layout({ children, right }) {
  const { email, commerciale, isAdmin, signOut } = useAuth();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">☕</span>
          <div>
            <h1 className="text-lg font-bold leading-none text-slate-800">Cafezal CRM</h1>
            <p className="text-xs text-slate-500">Pipeline vendite</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {right}
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium text-slate-700">{commerciale || email}</div>
            <div className="text-xs text-slate-400">{isAdmin ? 'Admin' : 'Commerciale'}</div>
          </div>
          <button
            onClick={signOut}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Esci
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
