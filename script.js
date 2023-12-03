document.addEventListener('DOMContentLoaded', function() {
    const output = document.getElementById('output');
    const commandInput = document.getElementById('command-input');
    const terminalHeader = document.getElementById('terminal-header');

    // Greet the user on page load
    output.innerHTML += 'Welcome, cutie!\n';
    output.innerHTML += 'This is the cutest terminal ever made by eli.\n';

    // Set the terminal header
    terminalHeader.innerHTML = "Cute Terminal";

    commandInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const command = commandInput.value.trim();
            commandInput.value = '';

            if (command !== '') {
                output.innerHTML += `> ${command}\n`;
                processCommand(command);
            }
        }
    });

    function processCommand(command) {
        const commandArgs = command.split(' ');
        const commandName = commandArgs[0];

        switch (commandName) {
            case 'help':
                output.innerHTML += 'Available commands: help, about, cute, clear, date, time\n';
                break;
            case 'about':
                output.innerHTML += 'This is the cutest terminal ever made! It has a kawaii theme! Enjoy!\n';
                break;
            case 'cute':
                output.innerHTML += 'You are the cutest person ever! Stay adorable!\n';
                break;
            case 'clear':
                output.innerHTML = '';
                break;
            case 'date':
                const currentDate = new Date().toLocaleDateString();
                output.innerHTML += `${currentDate}\n`;
                break;
            case 'time':
                const currentTime = new Date().toLocaleTimeString();
                output.innerHTML += `${currentTime}\n`;
                break;
            default:
                if (commandName === 'mybf') {
                    output.innerHTML += 'matty b raps is the cutest cutie on earth and means so much to me.\n';
                } else {
                    output.innerHTML += `Command not found: ${command}\n`;
                }
        }

        output.scrollTop = output.scrollHeight;
    }
});
