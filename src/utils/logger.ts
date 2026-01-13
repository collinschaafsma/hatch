import kleur from "kleur";

export const log = {
	info: (msg: string) => console.log(kleur.cyan("info"), msg),
	success: (msg: string) => console.log(kleur.green("success"), msg),
	warn: (msg: string) => console.log(kleur.yellow("warn"), msg),
	error: (msg: string) => console.log(kleur.red("error"), msg),
	step: (msg: string) => console.log(kleur.blue("->"), msg),
	blank: () => console.log(),
};
