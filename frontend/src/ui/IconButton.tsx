import {
	cloneElement,
	type ComponentPropsWithoutRef,
	type ElementType,
	type ReactElement,
} from "react";

type IconButtonBaseProps = {
	icon: ReactElement;
	active?: boolean;
	sizeClassName?: string;
	iconClassName?: string;
	baseClassName?: string;
	activeClassName?: string;
	inactiveClassName?: string;
	className?: string;
};

type IconButtonProps<T extends ElementType> = IconButtonBaseProps &
	Omit<ComponentPropsWithoutRef<T>, "children" | "className"> & {
		as?: T;
	};

const defaultBaseClassName =
	"inline-flex items-center justify-center rounded-lg border transition";
const defaultSizeClassName = "h-8 w-8";
const defaultIconClassName = "h-4 w-4";

const IconButton = <T extends ElementType = "button">(
	props: IconButtonProps<T>
) => {
	const {
		as,
		icon,
		active = false,
		sizeClassName = defaultSizeClassName,
		iconClassName = defaultIconClassName,
		baseClassName = defaultBaseClassName,
		activeClassName = "",
		inactiveClassName = "",
		className = "",
		...rest
	} = props;

	const Component = (as ?? "button") as ElementType;
	const stateClassName = active ? activeClassName : inactiveClassName;
	const combinedClassName = [
		baseClassName,
		sizeClassName,
		stateClassName,
		className,
	]
		.filter(Boolean)
		.join(" ");

	const clonedIcon = cloneElement(icon, {
		className: [iconClassName, (icon.props as { className?: string })?.className].filter(Boolean).join(" "),
	} as React.Attributes);

	const sharedProps: ComponentPropsWithoutRef<T> = {
		...(rest as ComponentPropsWithoutRef<T>),
		className: combinedClassName,
	};

	if (Component === "button" && !(rest as { type?: string }).type) {
		(sharedProps as ComponentPropsWithoutRef<"button">).type = "button";
	}

	return <Component {...sharedProps}>{clonedIcon}</Component>;
};

export default IconButton;

