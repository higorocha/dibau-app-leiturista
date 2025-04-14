// src/types/models.ts
export interface Cultura {
    id: number;
    descricao: string;
    periodicidade?: string;
    permitirConsorcio?: boolean;
    LotesCulturas?: {
        areaPlantada: number;
        areaProduzindo: number;
      };
  }
  
  export interface LoteCultura {
    id?: number;
    culturaId: number;
    areaPlantada: number;
    areaProduzindo: number;
    isNew?: boolean;
    isEditing?: boolean;
    isDeleted?: boolean;
    isSaved?: boolean;
    isPending?: boolean;
  }
  
  export interface Cliente {
    id: number;
    nome: string;
  }
  
  export interface Lote {
    id: number;
    nomeLote: string;
    responsavelId: number;
    areaTotal: number;
    areaLote: number;
    sobraarea: number;
    categoria: string;
    situacao: string;
    Cliente?: Cliente;
    Culturas?: Cultura[];
    LotesCulturas?: LoteCultura[];
    isPendingSync?: boolean;
  }