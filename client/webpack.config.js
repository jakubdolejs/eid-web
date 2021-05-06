const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: "./src/index.ts",
  mode: "development",
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      }
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "node_modules\/@microblink\/blinkid\-in\-browser\-sdk\/resources",
          to: "resources"
        }
      ]
    })
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      "path": false,
      "fs": false
    }
  },
  experiments: {
    outputModule: true
  },
  output: {
    library: {
        type: "module"
    },
    filename: "index.js",
    path: path.resolve(__dirname, "dist"),
    clean: true
  },
};