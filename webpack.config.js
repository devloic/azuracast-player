/**
 * Webpack client-side config file
 */
const path = require("path");
const webpack = require("webpack");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const isProd = process.env.NODE_ENV === "production";

// dev server and globals styles
const serverHost = "0.0.0.0";
const serverPort = 4321;
const basePath = path.join(__dirname, "/");
const appEntry = "./src/app.js";
const bundleDir = "./public/bundles/";

// webpack config
module.exports = {
  entry: {
    app: appEntry,
  },

  output: {
    path: basePath,
    filename: path.join(bundleDir, "[name].min.js"),
  },

  resolve: {
    alias: {
      'vue': 'vue/dist/vue.esm-bundler.js'
    }
  },

  module: {
    rules: [
      {
        test: /\.(jpe?g|png|gif|svg|map|css|eot|woff|woff2|ttf)$/,
        loader: "ignore-loader",
      },
      {
        test: /\.scss$/i,
        exclude: /node_modules/,
        use: [
          MiniCssExtractPlugin.loader,
          // Translates CSS into CommonJS
          { loader: "css-loader", options: { url: false, sourceMap: true } },
          // Compiles Sass to CSS
          {
            loader: "sass-loader",
            options: {
              implementation: require("sass"),
              sourceMap: true,
            },
          },
        ],
      },
      {
        test: /\.js(\?.*)?$/i,
        exclude: /node_modules/,
        loader: "babel-loader",
      },
    ],
  },

  plugins: [
    new MiniCssExtractPlugin({
      filename: path.join(bundleDir, "[name].min.css"),
    }),
    new webpack.DefinePlugin({
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false
    }),
  ],
  optimization: {
    minimize: true,
    minimizer: [
      // CSS minimizer
      new CssMinimizerPlugin({
        minimizerOptions: {
          preset: [
            "default",
            {
              discardComments: { removeAll: true },
            },
          ],
        },
        minify: CssMinimizerPlugin.cleanCssMinify,
      }),
      // Javascript minimizer
      new TerserPlugin({
        terserOptions: {
          ecma: undefined,
          warnings: false,
          parse: {},
          compress: {},
          mangle: true, // Note `mangle.properties` is `false` by default.
          module: false,
          output: null,
          toplevel: false,
          nameCache: null,
          ie8: false,
          keep_classnames: undefined,
          keep_fnames: false,
          safari10: false,
          format: {
            comments: false,
          },
        },
        extractComments: false,
      }),
    ],
  },

  devServer: {
    host: serverHost,
    port: serverPort,
    static: {
      directory: basePath,
    },
    hot: true,
    liveReload: true,
    compress: true,
    open: true,
    client: {
      logging: 'info',
      overlay: {
        errors: true,
        warnings: false,
      },
    },
  },

  performance: {
    hints: isProd ? "warning" : false,
    maxEntrypointSize: 1000000,
    maxAssetSize: 1000000,
  },
  mode: "development",
};

if (isProd) {
  module.exports.plugins = (module.exports.plugins || []).concat([
    new webpack.DefinePlugin({
      "process.env": {
        NODE_ENV: '"production"',
      },
    }),
    new webpack.optimize.TerserPlugin({
      compress: {
        warnings: false,
      },
    }),
    new webpack.LoaderOptionsPlugin({
      minimize: true,
    }),
  ]);
}
