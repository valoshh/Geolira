/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  distDir: ".next-build",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default config;
