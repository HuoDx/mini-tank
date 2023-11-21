import {defs, tiny} from '../examples/common.js';
// Pull these names into this module's scope for convenience:
const {
    hex_color,
    Vector,
    vec3,
    vec4, 
    vec,
    color, 
    Matrix, 
    Mat4, 
    Light, 
    Shape, 
    Material, 
    Shader, 
    Texture, 
    Scene} = tiny;
const {
    Cube, 
    Axis_Arrows, 
    Textured_Phong, 
    Phong_Shader, 
    Basic_Shader, 
    Subdivision_Sphere} = defs;
import {Shape_From_File} from '../examples/obj-file-demo.js';

import {
    Color_Phong_Shader, 
    Shadow_Textured_Phong_Shader,
    Depth_Texture_Shader_2D, 
    Buffered_Texture, 
    LIGHT_DEPTH_TEX_SIZE} from '../examples/shadow-demo-shaders.js';

import { ShadowCastingScene } from './shadow-casting-scene.js';

class TankControl extends Scene {
    // **Movement_Controls** is a Scene that can be attached to a canvas, like any other
    // Scene, but it is a Secondary Scene Component -- meant to stack alongside other
    // scenes.  Rather than drawing anything it embeds both first-person and third-
    // person style controls into the website.  These can be used to manually move your
    // camera or other objects smoothly through your scene using key, mouse, and HTML
    // button controls to help you explore what's in it.
    constructor() {
        super();
    }

    set_recipient(matrix_closure, inverse_closure) {
        // set_recipient(): The camera matrix is not actually stored here inside Movement_Controls;
        // instead, track an external target matrix to modify.  Targets must be pointer references
        // made using closures.
        this.matrix = matrix_closure;
        this.inverse = inverse_closure;
    }

    reset(graphics_state) {
        // reset(): Initially, the default target is the camera matrix that Shaders use, stored in the
        // encountered program_state object.  Targets must be pointer references made using closures.
        this.set_recipient(() => graphics_state.camera_transform,
            () => graphics_state.camera_inverse);
    }

    add_mouse_controls(canvas) {
        document.addEventListener("mouseup", e => {
            this.mouse.anchor = undefined;
        });
        canvas.addEventListener("mousedown", e => {
            e.preventDefault();
            this.mouse.anchor = mouse_position(e);
        });
        this.thrust = 0; this.rotation = 0;
    }

    show_explanation(document_element) {
    }

    make_control_panel() {
        // make_control_panel(): Sets up a panel of interactive HTML elements, including
        // buttons with key bindings for affecting this scene, and live info readouts.
        this.control_panel.innerHTML += "WASD to move the tank";
        this.thrust = 0; this.rotation = 0;
        
        this.new_line();

        this.new_line();
        this.key_triggered_button("Forward", ["w"], () => this.thrust = 1 , undefined, () => this.thrust = 0);
        this.key_triggered_button("Left", ["a"], () => this.rotation = 1, undefined, () => this.rotation = 0);
        this.key_triggered_button("Back", ["s"], () => this.thrust = -1, undefined, () => this.thrust = 0);
        this.key_triggered_button("Right", ["d"], () => this.rotation = -1, undefined, () => this.rotation = 0);
        this.new_line();
        //this.key_triggered_button("(Un)freeze mouse look around", [" "], () => this.look_around_locked ^= 1, "#8B8885");
    }
    getThrusAndRotation() {
        return {
            "thrust": this.thrust,
            "rotation": this.rotation
        }
    }

    display(context, graphics_state) {

    }
}

export class MiniTankGame extends ShadowCastingScene{
    constructor() {
        
        super();
        this.tankTransform = Mat4.identity();

        this.shapes = {
            "tank": new Shape_From_File("assets/tank.obj"),
            "sphere": new Subdivision_Sphere(6),
            "cube": new Cube(),
        };

        // For the teapot
        this.stars = new Material(new Shadow_Textured_Phong_Shader(1), {
            color: color(.5, .5, .5, 1),
            ambient: .4, diffusivity: .5, specularity: .5,
            color_texture: new Texture("assets/stars.png"),
            light_depth_texture: null

        });
        this.grass = new Material(new Shadow_Textured_Phong_Shader(1), {
            color: color(.5, .5, .5, 1),
            ambient: .6, diffusivity: .8, specularity: .1,
            color_texture: new Texture("assets/grass.png"),
            light_depth_texture: null

        });
        // For the floor or other plain objects
        this.floor = new Material(new Shadow_Textured_Phong_Shader(1), {
            color: color(1, 1, 1, 1), ambient: .3, diffusivity: 0.6, specularity: 0.4, smoothness: 64,
            color_texture: null,
            light_depth_texture: null
        })
        this.tank = new Material(new Color_Phong_Shader(), {color: hex_color("#002d4d")})
        // For the first pass
        this.pure = new Material(new Color_Phong_Shader(), {
        })
    }
    
    render(context, program_state, shadow_pass, dt = program_state.animation_delta_time / 1000) {
        if (!context.scratchpad.controls) {
            this.tankControl = new TankControl();
            this.children.push(context.scratchpad.controls = this.tankControl);
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(Mat4.look_at(
                vec3(0, 12, 12),
                vec3(0, 2, 0),
                vec3(0, 1, 0)
            )); // Locate the camera here
        }
        const t = program_state.animation_time;
        const thrustSpeed = 1.5, rotationSpeed = 0.4;
        let tr = this.tankControl.getThrusAndRotation();

        if(tr.thrust)
            this.tankTransform = this.tankTransform.times(Mat4.translation(thrustSpeed * dt * tr.thrust,0,0));
        if(tr.rotation)
            this.tankTransform = this.tankTransform.times(Mat4.rotation(rotationSpeed * dt * tr.rotation,0,1,0));
        let model_trans_floor = Mat4.scale(30, 0.01, 30);
        let tank_transform = Mat4.identity();
        
        // apply tank movement
        tank_transform = tank_transform.times(this.tankTransform);
        tank_transform = tank_transform.times(Mat4.translation(0,0.5,0)).times(Mat4.scale(2,2,2));
        this.shapes.cube.draw(context, program_state, model_trans_floor, shadow_pass ? this.grass : this.pure);
        this.shapes.tank.draw(context, program_state, tank_transform, shadow_pass ? this.stars: this.pure);
        
        let tpmatrix = this.tankTransform.times(vec4(0,0,0,1));

        let desired = Mat4.inverse(Mat4.translation(tpmatrix[0], tpmatrix[1] + 10, tpmatrix[2] + 25).times(Mat4.rotation(-Math.PI/8,1,0,0)));
        desired = desired.map((x, i) => Vector.from(program_state.camera_inverse[i]).mix(x, 0.03));
        program_state.set_camera(desired);

    }
    
}