module.exports = {
    semi: false,
    singleQuote: true,
    printWidth: 100,
    tabWidth: 4,
    useTabs: false,
    trailingComma: 'es5',
    bracketSpacing: true,
    endOfLine: 'auto',
    importOrder: ['^@core/(.*)$', '^@server/(.*)$', '^@ui/(.*)$', '^[./]'],
    importOrderSortSpecifiers: true,
    plugins: ['prettier-plugin-tailwindcss'],
}
