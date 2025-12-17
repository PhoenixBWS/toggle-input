# toggle-input
![Static Badge](https://img.shields.io/badge/version-1.0.0-green?style=plastic)
   
HTML5 Web Component that mimics a toggle switch and can be used inside HTML forms as a beautiful alternative to a checkbox.

## Features
`toggle-input` has the absolutely native-like features.
- Mirrors native checkbox behavior using a hidden `<input type="checkbox">` inside shadow DOM
- Supports: `checked, disabled, name, value, required, indeterminate, autofocus, tabindex`
- Emits native-like `'input'` and `'change'` only on user interactions
- Participates in forms via ElementInternals or a hidden fallback input
- Supports Dark Mode

## Usage
Just include the script as a module inside the `<head></head>` tag  
    
    <script type="module" src="toggle-input.js" async ></script>

Then use it anywhere in the `<body></body>` tag  
    
    <toggle-input name="likesCoding" value="on" checked />

## Example

    <html>
    <head>
        <script type="module" src="toggle-input.js" async ></script>
    </head>
    <body>
        <form method="POST" action="/target" >
           <toggle-input name="likesCoding" value="on" checked />
        </form>
    </body>
    </html>

## License
Apache License 2.0
View the License file for details

Thank you
