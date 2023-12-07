import { defs, tiny } from '../examples/common.js';
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
    Scene } = tiny;
const {
    Cube,
    Axis_Arrows,
    Textured_Phong,
    Phong_Shader,
    Basic_Shader,
    Subdivision_Sphere } = defs;
import { Shape_From_File } from '../examples/obj-file-demo.js';

import {
    Color_Phong_Shader,
    Shadow_Textured_Phong_Shader,
    Depth_Texture_Shader_2D,
    Buffered_Texture,
    LIGHT_DEPTH_TEX_SIZE
} from '../examples/shadow-demo-shaders.js';

import { ShadowCastingScene } from './shadow-casting-scene.js';

import { Body } from '../examples/collisions-demo.js';

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
        this.thrust = 0; this.rotation = 0; this.turretRotation = 0; this.fire = 0

        this.new_line();

        this.new_line();
        this.key_triggered_button("Forward", ["w"], () => this.thrust = 1, undefined, () => this.thrust = 0);
        this.key_triggered_button("Left", ["a"], () => this.rotation = 1, undefined, () => this.rotation = 0);
        this.key_triggered_button("Back", ["s"], () => this.thrust = -0.4, undefined, () => this.thrust = 0);
        this.key_triggered_button("Right", ["d"], () => this.rotation = -1, undefined, () => this.rotation = 0);
        this.new_line();
        this.key_triggered_button("Left Rotate Turret", [","], () => this.turretRotation = 1, undefined, () => this.turretRotation = 0);
        this.key_triggered_button("Right Rotate Turret", ["."], () => this.turretRotation = -1, undefined, () => this.turretRotation = 0);
        this.new_line();
        this.key_triggered_button("Fire the Gun", ["f"], () => this.fire = 1, undefined, () => this.fire = 0);
        //this.key_triggered_button("(Un)freeze mouse look around", [" "], () => this.look_around_locked ^= 1, "#8B8885");
    }
    getThrustAndRotation() {
        let data = {
            "thrust": this.thrust,
            "rotation": this.rotation,
            "fire": this.fire,
            "turretRotation": this.turretRotation
        };
        this.fire = 0; // resets back after read
        return data
    }

    display(context, graphics_state) {

    }
}

export class MiniTankGame extends ShadowCastingScene {
    constructor() {

        super();
        this.tankTransform = Mat4.identity().times(Mat4.translation(0, 0, 15)); // spawning position
        this.turretRotation = Mat4.identity();
        this.enemyTankTransform = Mat4.identity().times(Mat4.translation(0, 0, -15).times(Mat4.rotation(Math.PI, 0, 1, 0))); // spawning position
        this.enemyTurretRotation = Mat4.identity();
        this.modelAdjustment = Mat4.translation(0, 0.72, 0).times(Mat4.scale(2, 2, 2));
        this.shapes = {
            "tank": new Shape_From_File("assets/tank.obj"),
            "tankWheels": new Shape_From_File("assets/wheels.obj"),
            "tankBody": new Shape_From_File("assets/body.obj"),
            "tankTurret": new Shape_From_File("assets/turret.obj"),
            "sphere": new Subdivision_Sphere(6),
            "cube": new Cube(),
        };

        this.tank = new Material(new Shadow_Textured_Phong_Shader(1), {
            color: color(.5, .5, .5, 1),
            ambient: .4, diffusivity: .5, specularity: .5,
            color_texture: new Texture("assets/Tank.png"),
            light_depth_texture: null

        });

        this.enemy_tank = new Material(new Shadow_Textured_Phong_Shader(1), {
            color: color(.5, .5, .5, 1),
            ambient: .4, diffusivity: .5, specularity: .5,
            color_texture: new Texture("assets/enemy_tank.jpeg"),
            light_depth_texture: null

        });

        this.wheel = new Material(new Shadow_Textured_Phong_Shader(1), {
            color: color(.5, .5, .5, 1),
            ambient: .4, diffusivity: .5, specularity: .5,
            color_texture: new Texture("assets/Wheel.png"),
            light_depth_texture: null

        });
        this.grass = new Material(new Shadow_Textured_Phong_Shader(1), {
            color: color(.5, .5, .5, 1),
            ambient: .6, diffusivity: .8, specularity: .1,
            color_texture: new Texture("assets/grass.png"),
            light_depth_texture: null

        });
        //this.tank = new Material(new Color_Phong_Shader(), { color: hex_color("#002d4d") })
        // For the first pass
        this.pure = new Material(new Color_Phong_Shader(), {
        })
        this.collider = { intersect_test: Body.intersect_sphere, points: new defs.Subdivision_Sphere(2), leeway: .3 }

        this.tank_bbox = new Body(this.shapes.cube, vec3(1, 1, 1), vec3(2., 1, 1))
        this.tank_shell_bbox = new Body(this.shapes.cube, vec3(1, 1, 1), vec3(2., 1, 1))
        this.enemy_bbox = new Body(this.shapes.cube, vec3(1, 1, 1), vec3(1, 1, 1))
        this.bbox_scale = Mat4.scale(2.8, 4, 4.2)
        this.is_tank_collide = false
        this.is_shell_collide = false

        this.has_tank_shell = false
        this.has_enemy_shell = false

    }
    initLightDepth() {
        this.tank.light_depth_texture = this.light_depth_texture;
        this.wheel.light_depth_texture = this.light_depth_texture;
        this.grass.light_depth_texture = this.light_depth_texture;
    }

    inMap(position) {
        return !(position[0] <= -26 || position[0] >= 26 ||
            position[2] <= -56 || position[2] >= 56);
    }

    // simple one, only control the turret based on the relative position
    getNaiveEnemyControl() {
        let tank_pos = this.tankTransform.times(vec4(0, 0, 0, 1));
        let enemy_pos = this.enemyTankTransform.times(vec4(0, 0, 0, 1));
        let relative_dir = tank_pos.minus(enemy_pos).to3()
        let enemey_turrent_transform = this.enemyTankTransform
            .times(this.modelAdjustment)
            .times(Mat4.scale(1.5, 1.5, 1.5))
            .times(Mat4.translation(0, 0.0, -0.3))
            .times(this.enemyTurretRotation)
            .times(Mat4.translation(0, 0.5, -1.5))
        let turrent_a = enemey_turrent_transform.times(vec4(0, 0, 0, 1))
        let turrent_b = enemey_turrent_transform.times(vec4(0, 0, -1, 1))
        let turrent_dir = turrent_b.minus(turrent_a).to3()
        let angle = Math.acos(relative_dir.dot(turrent_dir) / (relative_dir.norm() * turrent_dir.norm()))
        angle = angle * Math.sign(relative_dir.cross(turrent_dir)[1])

        let turretRotation = 0
        if (Math.abs(angle) > 0.03) {
            turretRotation = -Math.sign(angle)
        }

        return {
            "thrust": Math.random() * 0.8 - 0.4, // [-0.4 ,0.4]
            "rotation": Math.random() * 2 - 1, // [-1, 1]
            "turretRotation": turretRotation
        }
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
        const thrustSpeed = 1.5, rotationSpeed = 0.4, turretRotationSpeed = 0.3;
        const bulletFlyingSpeed = 1;

        let model_trans_floor = Mat4.scale(30, 0.01, 60);
        this.shapes.cube.draw(context, program_state, model_trans_floor, shadow_pass ? this.grass : this.pure);

        // playing input handling
        let TR = this.tankControl.getThrustAndRotation();
        // enemy input handling
        if (!this.enemyLogicTimer) {
            this.enemyLogicTimer = program_state.animation_time;
            this.enemyAction = this.getNaiveEnemyControl();
        } else if (program_state.animation_time - this.enemyLogicTimer > 3000) {
            this.enemyLogicTimer = program_state.animation_time;
            this.enemyAction = this.getNaiveEnemyControl();
        }
        let enemy_TR = this.enemyAction;

        if (TR.rotation)
            this.tankTransform = this.tankTransform.times(Mat4.rotation(rotationSpeed * dt * TR.rotation, 0, 1, 0));
        if (TR.turretRotation)
            this.turretRotation = this.turretRotation.times(Mat4.rotation(turretRotationSpeed * dt * TR.turretRotation, 0, 1, 0))
        let old_tank_transform = this.tankTransform
        let old_enemy_tank_transform = this.enemyTankTransform

        // implement movement
        if (TR.thrust)
            this.tankTransform = this.tankTransform.times(Mat4.translation(0, 0, -thrustSpeed * dt * TR.thrust));

        if (enemy_TR.thrust)
            this.enemyTankTransform = this.enemyTankTransform.times(Mat4.translation(0, 0, -thrustSpeed * dt * enemy_TR.thrust));
        if (enemy_TR.rotation)
            this.enemyTankTransform = this.enemyTankTransform.times(Mat4.rotation(rotationSpeed * dt * enemy_TR.rotation, 0, 1, 0));

        if (enemy_TR.turretRotation)
            this.enemyTurretRotation = this.enemyTurretRotation.times(Mat4.rotation(turretRotationSpeed * dt * enemy_TR.turretRotation, 0, 1, 0))
        if (TR.fire && !this.has_tank_shell) {
            this.has_tank_shell = true;
            this.tank_shell_transform = this.tankTransform
                .times(Mat4.translation(0, 0.0, -1.0))
                .times(this.turretRotation)
                .times(Mat4.translation(0, 2.5, -7.5))
                .times(Mat4.scale(0.3, 0.3, 0.3));
        }
        // then 
        // collision detection 
        this.tank_bbox = this.tank_bbox.emplace(this.tankTransform.times(this.bbox_scale), vec3(0, 0, 0), 0)
        this.tank_bbox.inverse = Mat4.inverse(this.tank_bbox.drawn_location);
        this.enemy_bbox = this.enemy_bbox.emplace(this.enemyTankTransform.times(this.bbox_scale), vec3(0, 0, 0), 0)


        this.is_tank_collide = this.tank_bbox.check_if_colliding(this.enemy_bbox, this.collider)
        if (this.is_tank_collide) {
            this.tankTransform = old_tank_transform
            this.enemyTankTransform = old_enemy_tank_transform
        }
        // map boundary detection
        let playerTankPosition = this.tankTransform.times(vec4(0, 0, 0, 1));
        let enemyTankPosition = this.enemyTankTransform.times(vec4(0, 0, 0, 1));
        if (!this.inMap(playerTankPosition)) {
            this.tankTransform = old_tank_transform;
        }
        if (!this.inMap(enemyTankPosition))
            this.enemyTankTransform = old_enemy_tank_transform;

        if (this.has_tank_shell) {
            let bulletPosition = this.tank_shell_transform.times(vec4(0, 0, 0, 1));
            if (!this.inMap(bulletPosition)) this.has_tank_shell = false;
            this.tank_shell_bbox = this.tank_shell_bbox.emplace(this.tank_shell_transform.times(Mat4.scale(5, 5, 5)), vec3(0, 0, 0), 0)
            this.tank_shell_bbox.inverse = Mat4.inverse(this.tank_shell_bbox.drawn_location);
            this.is_shell_collide = this.tank_shell_bbox.check_if_colliding(this.enemy_bbox, this.collider)
            console.log(this.is_shell_collide)
            if (this.is_shell_collide) {
                this.has_tank_shell = false
            }
            else {
                this.tank_shell_transform = this.tank_shell_transform.times(Mat4.translation(0, 0, -1 * bulletFlyingSpeed))
            }
        }



        // model adjustment
        //tank_transform = tank_transform.times(Mat4.translation(0, 0.72, 0)).times(Mat4.scale(2, 2, 2));

        // this.shapes.tank.draw(context, program_state, tank_transform, shadow_pass ? this.stars : this.pure);
        this.shapes.tankTurret.draw(context, program_state,
            this.tankTransform
                .times(this.modelAdjustment)
                .times(Mat4.scale(1.5, 1.5, 1.5))
                .times(Mat4.translation(0, 0.0, -0.3))
                .times(this.turretRotation)
                .times(Mat4.translation(0, 0.5, -1.5)),
            shadow_pass ? this.tank : this.pure);
        this.shapes.tankBody.draw(context, program_state,
            this.tankTransform
                .times(this.modelAdjustment)
                .times(Mat4.scale(2, 2, 2))
                .times(Mat4.translation(0, 0.15, 0)),
            shadow_pass ? this.tank : this.pure);
        this.shapes.tankWheels.draw(context, program_state,
            this.tankTransform
                .times(this.modelAdjustment)
                .times(Mat4.translation(-1, 0, 0)),
            shadow_pass ? this.wheel : this.pure);
        this.shapes.tankWheels.draw(context, program_state,
            this.tankTransform
                .times(this.modelAdjustment)
                .times(Mat4.translation(1, 0, 0)),
            shadow_pass ? this.wheel : this.pure);

        // draw the enemy tank
        this.shapes.tankTurret.draw(context, program_state,
            this.enemyTankTransform
                .times(this.modelAdjustment)
                .times(Mat4.scale(1.5, 1.5, 1.5))
                .times(Mat4.translation(0, 0.0, -0.3))
                .times(this.enemyTurretRotation)
                .times(Mat4.translation(0, 0.5, -1.5)),
            shadow_pass ? this.enemy_tank : this.pure);
        this.shapes.tankBody.draw(context, program_state,
            this.enemyTankTransform
                .times(this.modelAdjustment)
                .times(Mat4.scale(2, 2, 2))
                .times(Mat4.translation(0, 0.15, 0)),
            shadow_pass ? this.enemy_tank : this.pure);
        this.shapes.tankWheels.draw(context, program_state,
            this.enemyTankTransform
                .times(this.modelAdjustment)
                .times(Mat4.translation(-1, 0, 0)),
            shadow_pass ? this.wheel : this.pure);
        this.shapes.tankWheels.draw(context, program_state,
            this.enemyTankTransform
                .times(this.modelAdjustment)
                .times(Mat4.translation(1, 0, 0)),
            shadow_pass ? this.wheel : this.pure);

        // draw bullet
        if (this.has_tank_shell) {
            this.shapes.sphere.draw(context, program_state,
                this.tank_shell_transform,
                shadow_pass ? this.tank : this.pure);
        }

        // camera follow
        let desired = Mat4.inverse(
            this.tankTransform
                .times(this.turretRotation)
                .times(Mat4.translation(0, 15, 25))
                .times(Mat4.rotation(-Math.PI / 6, 1, 0, 0)));

        // smooth camera movement
        desired = desired.map((x, i) => Vector.from(program_state.camera_inverse[i]).mix(x, 0.03));
        program_state.set_camera(desired);


        // draw bbox for debug

        // this.shapes.cube.draw(context, program_state,
        //     this.tankTransform
        //     .times(this.bbox_scale),
        //     shadow_pass ? this.tank : this.pure);

        // this.shapes.cube.draw(context, program_state,
        //     this.enemyTankTransform.times(this.bbox_scale),
        //     shadow_pass ? this.enemy_tank : this.pure);
        // if (this.has_tank_shell){
        //     this.shapes.cube.draw(context, program_state,
        //             this.tank_shell_transform,
        //             shadow_pass ? this.enemy_tank : this.pure);
        // }

    }

}