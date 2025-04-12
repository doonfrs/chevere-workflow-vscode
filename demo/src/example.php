<?php

use Chevere\Action\Interfaces\ActionInterface;
use Chevere\Parameter\Interfaces\ParameterInterface;
use Chevere\Parameter\Interfaces\ParametersInterface;

use function Chevere\Workflow\{sync,async,response,variable,workflow};
use function Chevere\Parameter\mixed;

workflow(
    thumb: async(
        new ImageResize(),
        
        
       
        
    ),
    medium: async(
        new ImageResize(),
        
    ),
    store: sync(
        new StoreFiles(),
        response('thumb', 'filename'),
        response('medium', 'filename'),
    ),
);



class ImageResize implements ActionInterface {
    public function __invoke(array $parameters): array {
        return [];
    }

    public function main(int $width, int $height, string $fit): array {
        // Process logic here
        return [];
    }

    public static function parameters(): ParametersInterface {
        // Properly implement to return ParametersInterface
        return new \Chevere\Parameter\Parameters();
    }

    public static function return(): ParameterInterface {
        // Properly implement to return ParameterInterface
        return mixed();
    }

    public static function mainMethod(): string {
        return 'main';
    }

    public static function assert(): \Chevere\Action\Interfaces\ReflectionActionInterface {
        return new \Chevere\Action\ReflectionAction(self::class);
    }
}



class StoreFiles implements ActionInterface {
    public function __invoke(array $parameters): array {
        return [];
    }

    public function main(): array {
        return [];
    }

    public static function parameters(): ParametersInterface {
        return new \Chevere\Parameter\Parameters();
    }
    
    public static function return(): ParameterInterface {
        return mixed();
    }

    public static function mainMethod(): string {
        return 'main';
    }

    public static function assert(): \Chevere\Action\Interfaces\ReflectionActionInterface {
        return new \Chevere\Action\ReflectionAction(self::class);
    }
}
