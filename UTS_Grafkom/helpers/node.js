// =====================================================================
//  node.js — scene-graph classes for Eddy, Poby and Loopy
//
//   Node      parent -> children hierarchy (Eddy, Loopy, environment).
//             Loopy's version = Eddy's + optional scale (default [1,1,1]).
//   MyObject  the course hierarchical object (Poby).
// =====================================================================
import { LIBS, POBY_LIBS } from "./libs.js";

// #####################################################################
//  Node (Eddy + Loopy + environment)
// #####################################################################
// Node = satu bagian tubuh dalam hierarki (parent -> children).
// position / rotation / scale bersifat LOKAL terhadap parent, jadi kalau parent bergerak, semua anaknya ikut.
export class Node {
    constructor(name, position, rotation, scale) {
        this.name = name;
        this.position = position || [0, 0, 0];   // [x, y, z] relatif terhadap parent
        this.rotation = rotation || [0, 0, 0];   // [rx, ry, rz] radian, relatif terhadap parent
        this.scale = scale || [1, 1, 1];         // [sx, sy, sz] (dipakai untuk kedip mata)
        this.mesh = null;                        // buffer GPU (boleh kosong untuk node "sendi/pivot")
        this.parent = null;
        this.children = [];
    }

    add(child) {
        child.parent = this;
        this.children.push(child);
        return child;
    }

    getLocalMatrix() { return LIBS.compose(this.position, this.rotation, this.scale); }

    // World = Parent * Local, lalu diteruskan ke seluruh anak
    draw(parentMatrix, render) {
        var world = LIBS.multiply(parentMatrix, this.getLocalMatrix());
        if (this.mesh) render(this.mesh, world);
        for (var i = 0; i < this.children.length; i++) this.children[i].draw(world, render);
    }

    find(name) {
        if (this.name === name) return this;
        for (var i = 0; i < this.children.length; i++) {
            var r = this.children[i].find(name);
            if (r) return r;
        }
        return null;
    }

    printTree(depth) {
        depth = depth || 0;
        console.log("  ".repeat(depth) + (depth ? "└ " : "") + this.name);
        this.children.forEach(function (c) { c.printTree(depth + 1); });
    }
}

// #####################################################################
//  MyObject (Poby)
// #####################################################################
// =====================================================================
//  node.js — the hierarchical object class from the course
//  (pertemuan 5, "Hierarchical Object (OOP WebGL)").
//
//  Same idea as the course version:
//    POSITION_MATRIX : where the part sits on its parent (set once)
//    MOVE_MATRIX     : extra movement around its own origin (for animation)
//    childs          : parts attached to this one
//    render(PARENT)  : MODEL = MOVE × POSITION × PARENT, then draw children
//
//  Added for Poby:
//    - normals (needed for Phong shading)
//    - mesh passed in the constructor instead of the default cube
//    - instances: draw the same mesh at many positions (instanced drawing,
//      pertemuan 5) — used for the mouth and claw lines
// =====================================================================

export class MyObject {
    GL = null;
    SHADER_PROGRAM = null;

    _position = null;
    _color = null;
    _normal = null;
    _MMatrix = null;

    OBJECT_VERTEX = null;
    OBJECT_FACES = null;

    vertex = [];
    faces = [];

    POSITION_MATRIX = POBY_LIBS.get_I4();   // Mpos
    MOVE_MATRIX     = POBY_LIBS.get_I4();   // Mmove

    childs = [];
    instances = [];                    // list of [x, y, z]; empty = draw once
    name = "";

    constructor(GL, SHADER_PROGRAM, _position, _color, _normal, _Mmatrix, mesh, name) {
        this.GL = GL;
        this.SHADER_PROGRAM = SHADER_PROGRAM;
        this._position = _position;
        this._color = _color;
        this._normal = _normal;
        this._MMatrix = _Mmatrix;
        this.vertex = mesh ? mesh.vertices : [];
        this.faces = mesh ? mesh.faces : [];
        this.name = name || "";
    }

    setup() {
        if (this.faces.length > 0) {
            this.OBJECT_VERTEX = this.GL.createBuffer();
            this.GL.bindBuffer(this.GL.ARRAY_BUFFER, this.OBJECT_VERTEX);
            this.GL.bufferData(this.GL.ARRAY_BUFFER, new Float32Array(this.vertex), this.GL.STATIC_DRAW);

            this.OBJECT_FACES = this.GL.createBuffer();
            this.GL.bindBuffer(this.GL.ELEMENT_ARRAY_BUFFER, this.OBJECT_FACES);
            this.GL.bufferData(this.GL.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.faces), this.GL.STATIC_DRAW);
        }
        this.childs.forEach(child => child.setup());
    }

    draw(MATRIX) {
        this.GL.uniformMatrix4fv(this._MMatrix, false, MATRIX);
        this.GL.bindBuffer(this.GL.ARRAY_BUFFER, this.OBJECT_VERTEX);
        this.GL.vertexAttribPointer(this._position, 3, this.GL.FLOAT, false, 36, 0);
        this.GL.vertexAttribPointer(this._color,    3, this.GL.FLOAT, false, 36, 12);
        this.GL.vertexAttribPointer(this._normal,   3, this.GL.FLOAT, false, 36, 24);
        this.GL.bindBuffer(this.GL.ELEMENT_ARRAY_BUFFER, this.OBJECT_FACES);
        this.GL.drawElements(this.GL.TRIANGLES, this.faces.length, this.GL.UNSIGNED_SHORT, 0);
    }

    render(PARENT_MATRIX) {
        this.MODEL_MATRIX = POBY_LIBS.multiply(this.MOVE_MATRIX, this.POSITION_MATRIX);
        this.MODEL_MATRIX = POBY_LIBS.multiply(this.MODEL_MATRIX, PARENT_MATRIX);

        if (this.faces.length > 0) {
            this.GL.useProgram(this.SHADER_PROGRAM);
            if (this.instances.length === 0) {
                this.draw(this.MODEL_MATRIX);
            } else {
                // instanced drawing: same buffers, a different matrix each time
                for (var i = 0; i < this.instances.length; i++) {
                    var T = POBY_LIBS.get_I4();
                    POBY_LIBS.set_position(T, this.instances[i][0], this.instances[i][1], this.instances[i][2]);
                    this.draw(POBY_LIBS.multiply(T, this.MODEL_MATRIX));
                }
            }
        }
        this.childs.forEach(child => child.render(this.MODEL_MATRIX));
    }
}
