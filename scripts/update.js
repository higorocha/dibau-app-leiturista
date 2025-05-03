// scripts/update.js
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 Sistema de Atualização OTA - DIBAU');
console.log('-------------------------------');

rl.question('Digite a mensagem da atualização: ', (message) => {
  rl.question('Canal (1-production, 2-preview): ', (channel) => {
    const selectedChannel = channel === '1' ? 'production' : 'preview';
    
    console.log(`\n📤 Publicando no canal: ${selectedChannel}`);
    console.log(`📝 Mensagem: ${message}\n`);
    
    try {
      execSync(`eas update --channel ${selectedChannel} --message "${message}"`, {
        stdio: 'inherit'
      });
      
      console.log('\n✅ Atualização publicada com sucesso!');
      console.log('👉 Os usuários receberão a atualização automaticamente na próxima abertura do app.');
    } catch (error) {
      console.error('\n❌ Erro ao publicar atualização:', error.message);
    }
    
    rl.close();
  });
});