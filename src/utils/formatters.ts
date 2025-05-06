/**
 * Formata um número adicionando separadores de milhar
 * @param value Valor a ser formatado
 * @returns Valor formatado com separador de milhar
 */
export const formatarNumeroComMilhar = (value: number | string | undefined): string => {
    if (value === undefined || value === null) return '0';
    
    // Converter para string, substituir vírgulas por pontos, em seguida para número
    const numero = typeof value === 'string' 
      ? parseFloat(value.replace(',', '.'))
      : value;
      
    // Se não for um número válido, retorna 0
    if (isNaN(Number(numero))) return '0';
    
    // Formatar com ponto como separador de milhar
    return numero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };
  
  /**
   * Analisa uma string formatada com separadores de milhar
   * @param value String formatada
   * @returns Número
   */
  export const parsearNumeroComMilhar = (value: string): number => {
    // Remover todos os separadores de milhar (pontos)
    const valorSemSeparadores = value.replace(/\./g, '');
    
    // Substituir vírgula por ponto (para números decimais)
    const valorComPontoDecimal = valorSemSeparadores.replace(',', '.');
    
    // Converter para número
    return parseFloat(valorComPontoDecimal);
  };
  
  /**
   * Formata uma data no formato DD/MM/YYYY
   * @param data Data a ser formatada
   * @returns Data formatada
   */
  export const formatarData = (data: string | Date | undefined): string => {
    if (!data) return '-';
    
    try {
      // Se for string, trata especialmente para evitar problemas de timezone
      if (typeof data === 'string' && data.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Adiciona T00:00:00 para forçar parsing como local time
        const date = new Date(data + 'T00:00:00');
        if (isNaN(date.getTime())) return '-';
        
        const dia = String(date.getDate()).padStart(2, '0');
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const ano = date.getFullYear();
        
        return `${dia}/${mes}/${ano}`;
      }
      
      // Para Date objects ou outras strings
      const date = new Date(data);
      if (isNaN(date.getTime())) return '-';
      
      const dia = String(date.getDate()).padStart(2, '0');
      const mes = String(date.getMonth() + 1).padStart(2, '0');
      const ano = date.getFullYear();
      
      return `${dia}/${mes}/${ano}`;
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return '-';
    }
  };

  export const formatMesAno = (mesAno: string): string => {
    const [mes, ano] = mesAno.split("/");
    const meses = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];
  
    return `${meses[parseInt(mes) - 1]} de ${ano}`;
  };