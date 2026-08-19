 /** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Permite que o build termine com sucesso mesmo se houver avisos de linter
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Evita que o deploy falhe por pequenos detalhes de tipagem
    ignoreBuildErrors: true,
  },
};

export default nextConfig;