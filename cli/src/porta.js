import net from 'node:net';

function portaLivre(porta) {
  return new Promise((resolve) => {
    const servidor = net.createServer();
    servidor.once('error', () => resolve(false));
    servidor.listen(porta, '127.0.0.1', () => {
      servidor.close(() => resolve(true));
    });
  });
}

export async function escolherPorta({
  portaDesejada = 3000,
  limite = 50,
  portaLivreFn = portaLivre,
  portasReservadas = new Set(),
} = {}) {
  for (let porta = portaDesejada; porta < portaDesejada + limite; porta += 1) {
    if (portasReservadas.has(porta)) continue;
    if (await portaLivreFn(porta)) return porta;
  }
  throw new Error(
    `Nenhuma porta livre entre ${portaDesejada} e ${portaDesejada + limite - 1}.`
    + ' Libere uma porta ou defina GERONTICARE_PORT.',
  );
}
