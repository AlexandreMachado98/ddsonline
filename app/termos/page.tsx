import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Scale, Building2 } from 'lucide-react';
import DdsLogo from '@/components/DdsLogo';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Termos de Uso • DDS ON',
  description: 'Termos e Condições Gerais de Uso da Plataforma DDS Online (DDS ON).'
};

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-emerald-400 transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Voltar ao Início
          </Link>
          <DdsLogo size="sm" showSubtitle={false} />
        </div>

        {/* Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Scale size={14} /> Governança & Contratos SaaS
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            Termos de Uso da Plataforma
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Versão 1.0 • Vigência a partir de Setembro de 2026 • Documentação Oficial DDS ON
          </p>
        </div>

        {/* Content Box */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-8 text-xs sm:text-sm leading-relaxed text-slate-300">
          
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">1</span>
              Objeto e Escopo da Plataforma
            </h2>
            <p>
              O <strong>DDS Online (DDS ON)</strong> é uma plataforma SaaS (Software as a Service) desenvolvida para digitalização, registro eletrônico, coleta de evidências de presença e emissão de atas documentais de Diálogos Diários de Segurança (DDS), reuniões de Segurança e Saúde no Trabalho (SST) e treinamentos corporativos.
            </p>
            <p>
              O software atua como ferramenta facilitadora de comprovação probatória. O DDS Online <strong>não substitui</strong> a obrigatoriedade da condução presencial ou remota dos diálogos nem dispensa a observância integral das Normas Regulamentadoras (NRs) aprovadas pelo Ministério do Trabalho e Emprego (MTE).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">2</span>
              Divisão de Responsabilidades (RACI)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                <p className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <Building2 size={16} /> Empresa Cliente / Organizador
                </p>
                <ul className="list-disc list-inside text-slate-400 space-y-1 text-xs">
                  <li>Conteúdo programático e adequação às NRs aplicáveis.</li>
                  <li>Habilitação legal e qualificação técnica do instrutor.</li>
                  <li>Veracidade das informações, nomes e funções declaradas.</li>
                  <li>Download, guarda, arquivamento e custódia documental dos relatórios em PDF.</li>
                  <li>Conformidade com a legislação trabalhista e fiscalizações.</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                <p className="font-bold text-teal-400 flex items-center gap-1.5">
                  <ShieldCheck size={16} /> Plataforma DDS Online (DDS ON)
                </p>
                <ul className="list-disc list-inside text-slate-400 space-y-1 text-xs">
                  <li>Disponibilidade e desempenho da infraestrutura tecnológica.</li>
                  <li>Integridade criptográfica dos registros (cálculo de SHA-256).</li>
                  <li>Geração e disponibilização imediata dos relatórios em PDF.</li>
                  <li>Mecanismos de contingência e coleta de presença offline.</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">3</span>
              Assinaturas Eletrônicas e Evidências Probantes
            </h2>
            <p>
              As assinaturas colhidas na plataforma em tela sensível ao toque constituem <strong>Assinaturas Eletrônicas Simples</strong> nos termos do Artigo 3º, inciso I da <strong>Lei nº 14.063/2020</strong> e do Artigo 10, § 2º da <strong>Medida Provisória nº 2.200-2/2001</strong>.
            </p>
            <p>
              As partes declaram e acordam que as assinaturas eletrônicas simples, acompanhadas de fotografia facial de comprovação física, registro temporal de servidor (timestamp) e carimbo criptográfico SHA-256, possuem pleno valor probatório entre as partes para comprovação do Diálogo Diário de Segurança perante auditorias internas e fiscalizações trabalhistas.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">4</span>
              Imutabilidade, Encerramento e Isenção de Custódia Documental
            </h2>
            <p>
              Uma vez finalizada a reunião pelo organizador, o registro entra no estado <code>ENDED</code>. Nesse momento, o sistema gera o resumo criptográfico SHA-256 definitivo do documento. Alterações posteriores no corpo da ata, na lista de participantes ou no conteúdo programático são estritamente bloqueadas para assegurar a inviolabilidade documental.
            </p>
            <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-2">
              <p className="text-amber-300 font-bold text-xs">
                ⚠️ Responsabilidade Exclusiva de Guarda pelo Usuário / Empresa Contratante:
              </p>
              <p className="text-slate-300 text-xs leading-relaxed">
                A plataforma DDS Online tem a função exclusiva de viabilizar a realização, assinatura e emissão dos relatórios de DDS em formato PDF. <strong>A plataforma não possui qualquer obrigação ou responsabilidade pelo armazenamento contínuo, guarda de longo prazo ou custódia regulamentar desses dados</strong>. Uma vez emitido o relatório em PDF com as assinaturas, <strong>a responsabilidade pela sua retenção, download, backup e custódia documental perante auditorias e órgãos fiscalizadores é inteira e exclusivamente do usuário / empresa contratante</strong>.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">5</span>
              Propriedade Intelectual
            </h2>
            <p>
              A marca <strong>DDS ON</strong>, o software, as interfaces visuais, o código-fonte, scripts de geração de PDF e sistemas de sincronização offline pertencem exclusivamente aos seus desenvolvedores e mantenedores. É vedada qualquer engenharia reversa, sublicenciamento não autorizado ou extração de código.
            </p>
            <p>
              Os dados inseridos (textos, imagens de temas, fotos de presença e registros de colaboradores) permanecem de propriedade exclusiva da <strong>Empresa Cliente Contratante</strong>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">6</span>
              Disponibilidade, Continuidade e Modo Offline
            </h2>
            <p>
              A plataforma é disponibilizada com meta de nível de serviço (SLA) de disponibilidade mensal de 99,5%. A plataforma incorpora tecnologia <em>Offline-First (PWA)</em>, permitindo a coleta de presença e assinaturas mesmo na ausência completa de sinal de internet, com sincronização automática tão logo haja restabelecimento de conexão.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">7</span>
              Lei Aplicável e Foro
            </h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil, em especial o Marco Civil da Internet (Lei nº 12.965/2014) e a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Fica eleito o foro da comarca da sede da empresa mantenedora para dirimir quaisquer controvérsias oriundas deste instrumento.
            </p>
          </section>

        </div>

        {/* Footer links */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800/60 text-xs text-slate-500">
          <div>
            <p>© 2026 <strong>AM TST</strong>. Todos os direitos reservados.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">DDS ON é uma plataforma da AM TST.</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacidade" className="text-emerald-400 hover:underline">
              Aviso de Privacidade (LGPD)
            </Link>
            <span>•</span>
            <Link href="/" className="text-slate-400 hover:underline">
              Página Inicial
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
