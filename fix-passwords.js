const bcrypt = require('bcryptjs');

async function main() {
  const admin = await bcrypt.hash('admin2024', 10);
  const cliente = await bcrypt.hash('cliente2024', 10);
  console.log('ADMIN:', admin);
  console.log('CLIENTE:', cliente);
}
main();
```

Guarda con **Ctrl+S** y ejecuta:
```
node fix-passwords.js
