export default function AccessDenied() {
  return <main className="hub-page-bg flex min-h-svh items-center justify-center p-6">
    <section className="hub-card max-w-lg space-y-4 p-6">
      <h1 className="text-xl font-semibold">Acceso no autorizado</h1>
      <p>Tu cuenta necesita un alta y permisos locales para acceder a esta aplicación. Contacta con su administrador.</p>
      <form action="/logout" method="post"><button className="underline" type="submit">Volver al Hub</button></form>
    </section>
  </main>
}
