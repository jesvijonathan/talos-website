var NODES_X = Math.ceil( window.innerWidth * 0.025 ),
  NODES_Y = Math.ceil( window.innerHeight * 0.025 ),

  BEAT_VELOCITY = 0.01,
  BEAT_FREQUENCY = 2,
	BEAT_LIMIT = 3,

	// Distance threshold between active node and beat
	ACTIVATION_DISTANCE = 10,

	// Number of neighboring nodes to push aside on impact
	WAVE_RADIUS = 4;

// The world dimensions
var world = { 
		width: window.innerWidth, 
		height: window.innerHeight,
    	center: { x: window.innerWidth/2, y: window.innerHeight/2 }
	},

	id = 0,

	styles,

	query = {},

	activateNodeDistance = 0,
	currentBeat = null,
	currentStyle = null,

	nodes = [],
	beats = [];

/**
 * 
 */
function initialize() {
	var ctx = Sketch.create();

	styles = document.querySelector( '.styles' );
	styles.addEventListener( 'change', onStyleChanged, false );

	var hash = window.location.hash.slice(1);
	if( hash.length > 1 ) styles.value = hash;

	currentStyle = styles.value;

	// ctx.autoclear = false;

	ctx.setup = function() {
		// Distance between nodes
		var cx = world.width / ( NODES_X + 1 ),
			cy = world.height / ( NODES_Y + 1 );

		activateNodeDistance = Math.min( cx, cy ) * 0.5;

		var i,
			j,
			x = 0,
			y = 0,
			len = NODES_X * NODES_Y;

		// Generate nodes
		for( y = 0; y < NODES_Y; y++ ) {
			for( x = 0; x < NODES_X; x++ ) {
				nodes.push( new Node( cx + x * cx, cy + y * cy, x, y ) );
			}
		}

		// Determine node neighbors
		for( i = 0; i < len; i++ ) {
			var nodeA = nodes[i];

			for( j = 0; j < len; j++ ) {
				var nodeB = nodes[j];

				if( nodeA !== nodeB && nodeB.distanceToNode( nodeA ) < WAVE_RADIUS ) {
					nodeA.neighbors.push( nodeB );
				}
			}
		}

		// Generate beats
		for( i = 0; i < BEAT_LIMIT; i++ ) {
			var beat = new Beat( 
				world.center.x,
				world.center.y,
				i
			);

			beats.push( beat );
		}
	}

	ctx.draw = function() {
		// ctx.fillStyle = 'rgba( 0, 0, 0, 0.3 )';
		// ctx.fillRect( 0, 0, world.width, world.height );

		// Render nodes
		for( var i = 0, len = nodes.length; i < len; i++ ) {
			var node = nodes[i];

			this.updateNode( node );
			this.drawNode( node );
		}

		// Render beats
		ctx.save();

		var activeBeats = 0;

		for( var i = 0, len = beats.length; i < len; i++ ) {
			var beat = beats[i];

			this.updateBeat( beat );
			this.drawBeat( beat );

			if( beat.active ) activeBeats ++;
		}

		ctx.restore();

		var nextBeat = currentBeat ? beats[ ( currentBeat.index + 1 ) % beats.length ] : null;

		if( !currentBeat ) {
			currentBeat = beats[0];
			currentBeat.activate();
		}
		else if( !nextBeat.active && activeBeats < BEAT_FREQUENCY && currentBeat.strength > 1 / BEAT_FREQUENCY ) {
			currentBeat = nextBeat;
			currentBeat.activate();
		}
	}

	ctx.updateNode = function( node ) {
		// Active nodes that the mouse touches when pressed down CLICK MOUSEDOWN
		if( ctx.dragging ) {
			if( node.distanceTo( ctx.mouse.x, ctx.mouse.y ) < activateNodeDistance ) {
				if( node.active === false ) {
					node.activate();
				}
			}
		}

		// node.strength = Math.max( node.strength - 0.01, 0 );
		// node.strength += ( node.strengthTarget - node.strength ) * 0.2;
		node.size += ( node.sizeTarget - node.size ) * 0.05;

		if( node.growing ) {
			node.strength = Math.min( node.strength + 0.15, 1 );
		}
		else {
			node.strength = Math.max( node.strength - 0.02, 0 );
		}

		if( node.strength === 1 ) {
			node.growing = false;
		}

		node.offsetTargetX *= 0.6;
		node.offsetTargetY *= 0.6;

		node.offsetX += ( node.offsetTargetX - node.offsetX ) * 0.2;
		node.offsetY += ( node.offsetTargetY - node.offsetY ) * 0.2;

		if( node.strength > 0.1 ) {
			for( j = 0, jlen = node.neighbors.length; j < jlen; j++ ) {
				var neighbor = node.neighbors[j];

				var radians = Math.atan2( node.indexh - neighbor.indexh, node.indexv - neighbor.indexv ),
					distance = node.distanceToNode( neighbor ) * 0.75;

				neighbor.offsetX += Math.sin( radians - Math.PI ) * node.strength * ( WAVE_RADIUS - distance );
				neighbor.offsetY += Math.cos( radians - Math.PI ) * node.strength * ( WAVE_RADIUS - distance );
			}
		}
	}

	ctx.drawNode = function( node ) {
		// Angle and distance between node and center
		var radians = Math.atan2( world.center.y - node.y, world.center.x - node.x ),
			distance = node.distanceTo( world.center.x, world.center.y );

		var distanceFactor = distance / Math.min( world.width, world.height );

		// Offset for the pin head
		var ox = node.offsetX + Math.cos( radians - Math.PI ) * ( 30 * distanceFactor ) * node.strength,
			oy = node.offsetY + Math.sin( radians - Math.PI ) * ( 30 * distanceFactor ) * node.strength;

		var anchorTR = getNodeByIndex( node.indexh + 1, node.indexv ),
			anchorBR = getNodeByIndex( node.indexh + 1, node.indexv + 1 ), 
			anchorBL = getNodeByIndex( node.indexh, node.indexv + 1 );

		if( currentStyle === 'circle' ) {
			if( node.active ) {
				ctx.beginPath();
				ctx.arc( node.paintedX, node.paintedY, node.size * 25 * ( 0.1 + node.strength ), 0, Math.PI * 2, true );
				ctx.fillStyle = node.color;
				ctx.fill();

				node.size = 1;
			}
			else {
				node.size = node.sizeTarget || 1;
			}
		}
		else if( currentStyle === 'diagonal' ) {
			if( anchorTR && anchorBR && anchorBL ) {
				ctx.beginPath();
				ctx.moveTo( node.paintedX, node.paintedY );
				ctx.lineTo( anchorBR.paintedX, anchorBR.paintedY );
				ctx.strokeStyle = node.color;
				ctx.stroke();
			}

			node.size = node.sizeTarget || 0;
		}
		else if( currentStyle === 'grid' ) {
			if( anchorTR && anchorBR && anchorBL ) {
				ctx.beginPath();
				ctx.moveTo( node.paintedX, node.paintedY );
				ctx.lineTo( anchorTR.paintedX-1, anchorTR.paintedY );
				ctx.lineTo( anchorBR.paintedX-1, anchorBR.paintedY-1 );
				ctx.lineTo( anchorBL.paintedX, anchorBL.paintedY-1 );
				ctx.fillStyle = node.color;
				ctx.fill();
			}

			node.size = node.sizeTarget || 1;
		}
		else if( currentStyle === 'cross' ) {
			if( anchorTR && anchorBR && anchorBL ) {
				ctx.beginPath();
				ctx.moveTo( node.paintedX, node.paintedY );
				ctx.lineTo( anchorBR.paintedX, anchorBR.paintedY );
				ctx.moveTo( anchorTR.paintedX, anchorTR.paintedY );
				ctx.lineTo( anchorBL.paintedX, anchorBL.paintedY );
				ctx.strokeStyle = node.color;
				ctx.stroke();
			}

			node.size = node.sizeTarget || 0;
		}
		else {
			node.size = node.sizeTarget || 2;
		}

		node.paintedX = node.x + ox;
		node.paintedY = node.y + oy;

		// Pin head
		ctx.beginPath();
		ctx.arc( node.paintedX, node.paintedY, node.size, 0, Math.PI * 2, true );
		ctx.fillStyle = node.color;
		ctx.fill();

		// if( node.strength ) {
		// 	var radius = 4 + node.size * 20 * node.strength;
			
		// 	ctx.beginPath();
		// 	ctx.arc( node.x, node.y, radius, 0, Math.PI * 2, true );

		// 	var gradient = ctx.createRadialGradient( node.x, node.y, 0, node.x, node.y, radius );
		// 	gradient.addColorStop( 0, node.activeColorA );
		// 	gradient.addColorStop( 1, node.activeColorB );

		// 	ctx.fillStyle = gradient;
		// 	ctx.fill();
		// }
	}

	ctx.updateBeat = function( beat ) {
		if( beat.active ) {
			beat.strength += BEAT_VELOCITY;
		}

		// Remove used up beats
		if( beat.strength > 1 ) {
			beat.deactivate();
		}
		else if( beat.active ) {
			// Check for collision with nodes
			for( var j = 0, len = nodes.length; j < len; j++ ) {
				var node = nodes[j];

				if( node.active && node.collisionLevel < beat.level ) {
					// Distance between the beat wave and node
					var distance = Math.abs( node.distanceTo( beat.x, beat.y ) - ( beat.size * beat.strength ) );

					if( distance < ACTIVATION_DISTANCE ) {
						node.collisionLevel = beat.level;
						node.highlight();
					}
				}
			}
		}
	}

	ctx.drawBeat = function( beat ) {
		if( beat.active && beat.strength > 0 ) {
			ctx.beginPath();
			ctx.arc( beat.x, beat.y, Math.max( (beat.size * beat.strength)-2, 0 ), 0, Math.PI * 2, true );
			ctx.lineWidth = 8;
			ctx.globalAlpha = 0.2 * ( 1 - beat.strength );
			ctx.strokeStyle = beat.color;
			ctx.stroke();

			ctx.beginPath();
			ctx.arc( beat.x, beat.y, beat.size * beat.strength, 0, Math.PI * 2, true );
			ctx.lineWidth = 2;
			ctx.globalAlpha = 0.8 * ( 1 - beat.strength );
			ctx.strokeStyle = beat.color;
			ctx.stroke();
		}
	}

	ctx.keydown = function( event ) {
		if( event.keyCode == 32 ) {
			for( var i = 0, len = nodes.length; i < len; i++ ) {
				nodes[i].deactivate();
			}
		}
	}
}

function onStyleChanged( event ) {
	window.location.hash = styles.value;
	currentStyle = styles.value;
}

function getNodeByIndex( h, v ) {
	if( h >= NODES_X || h < 0 || v >= NODES_Y || v < 0 ) return null;

	return nodes[ ( v * NODES_X ) + h ];
}

/**
 * Represets one node/point in the grid.
 */
function Node( x, y, indexh, indexv ) {
	this.x = x;
	this.y = y;

	this.indexh = indexh;
	this.indexv = indexv;

	this.id = ++id;
	this.neighbors = [];
	this.collisionLevel = 0;
	this.active = false;
	this.growing = false;
	this.strength = 0;
	this.size = 0;
	this.sizeTarget = this.size;

	this.offsetX = 0;
	this.offsetY = 0;

	this.offsetTargetX = 0;
	this.offsetTargetY = 0;

	this.paintedX = this.x;
	this.paintedY = this.y;

	// this.color = 'hsla('+ ( x / world.width ) * 360 +', 50%, 60%, 1)'
	this.color = 'hsla('+ ( x / world.width ) * 360 +', 0%, 100%, 1)'
	this.activeColorA = 'hsla('+ ( x / world.width ) * 360 +', 50%, 60%, 0.8)';
	this.activeColorB = 'hsla('+ ( x / world.width ) * 360 +', 50%, 60%, 0)';
}
Node.prototype.distanceToNode = function( node ) {
	var dx = node.indexh - this.indexh;
	var dy = node.indexv - this.indexv;

	return Math.sqrt(dx*dx + dy*dy);
};
Node.prototype.distanceTo = function( x, y ) {
	var dx = x - this.paintedX;
	var dy = y - this.paintedY;

	return Math.sqrt(dx*dx + dy*dy);
};
Node.prototype.activate = function() {
	this.active = true;
	this.sizeTarget = 5;
};
Node.prototype.deactivate = function() {
	this.active = false;
	this.sizeTarget = 1;
};
Node.prototype.highlight = function( delay ) {
	this.growing = true;
};

/**
 * Represents a beat that triggers nodes.
 */
function Beat( x, y, index ) {
	this.x = x;
	this.y = y;
	this.color = 'hsla(180, 100%, 100%, 0.2)';
	this.index = index;
	this.level = ++id;
	this.size = Math.max( world.width, world.height ) * 0.65;
	this.active = false;
	this.strength = 0;
};
Beat.prototype.activate = function() {
	this.level = ++id;
	this.active = true;
	this.strength = 0;
};
Beat.prototype.deactivate = function() {
	this.active = false;
};


// shim layer with setTimeout fallback from http://paulirish.com/2011/requestanimationframe-for-smart-animating/
window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       || 
          window.webkitRequestAnimationFrame || 
          window.mozRequestAnimationFrame    || 
          window.oRequestAnimationFrame      || 
          window.msRequestAnimationFrame     || 
          function(/* function */ callback, /* DOMElement */ element){
            window.setTimeout(callback, 1000 / 60);
          };
})();


initialize();
