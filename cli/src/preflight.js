export function validarNode22(nodeVersion) {
  if (Number(nodeVersion.match(/^v(\d+)/)?.[1]) !== 22) {
    throw new Error('O GerontiCare requer Node 22.');
  }
}

export function validarPreflight({ nodeVersion, isTTY }) {
  validarNode22(nodeVersion);

  if (!isTTY) {
    throw new Error('A instalação requer um terminal interativo.');
  }
}
